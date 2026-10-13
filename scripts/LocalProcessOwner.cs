// Windows 10+ x64 / PowerShell 7. One job, no supervisor process or nested jobs.
// Children enter the job atomically at creation; stop/exit observations retain native handles.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace DeepLearnerLocal {
    sealed class Handle : SafeHandleZeroOrMinusOneIsInvalid {
        public Handle() : base(true) { }
        internal void Adopt(IntPtr value) { SetHandle(value); }
        protected override bool ReleaseHandle() { return Native.CloseHandle(handle); }
    }
    static class Native {
        [StructLayout(LayoutKind.Sequential)] internal struct Limits { internal long ProcessTime, JobTime; internal uint Flags; internal UIntPtr Min, Max; internal uint ActiveLimit; internal UIntPtr Affinity; internal uint Priority, Scheduling; }
        [StructLayout(LayoutKind.Sequential)] internal struct Counts { internal ulong A,B,C,D,E,F; }
        [StructLayout(LayoutKind.Sequential)] internal struct Extended { internal Limits Basic; internal Counts IO; internal UIntPtr ProcessMemory, JobMemory, PeakProcess, PeakJob; }
        [StructLayout(LayoutKind.Sequential)] internal struct Accounting { internal long A,B,C,D; internal uint Faults, Total, Active, Terminated; }
        [StructLayout(LayoutKind.Sequential)] internal struct Security { internal int Length; internal IntPtr Descriptor; internal int Inherit; }
        [StructLayout(LayoutKind.Sequential)] internal struct Startup { internal uint Size; internal IntPtr Reserved, Desktop, Title; internal uint X,Y,XSize,YSize,XChars,YChars,Fill,Flags; internal ushort Show,ReservedSize; internal IntPtr Bytes,Input,Output,Error; }
        [StructLayout(LayoutKind.Sequential)] internal struct StartupEx { internal Startup Startup; internal IntPtr Attributes; }
        [StructLayout(LayoutKind.Sequential)] internal struct ProcessInfo { internal IntPtr Process,Thread; internal uint Id,ThreadId; }
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool CloseHandle(IntPtr handle);
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] internal static extern Handle CreateJobObjectW(IntPtr security, string name);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool SetInformationJobObject(Handle job,int kind,ref Extended info,uint size);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool QueryInformationJobObject(Handle job,int kind,out Accounting info,uint size,IntPtr returned);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool TerminateJobObject(Handle job,uint code);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool IsProcessInJob(Handle process,Handle job,out bool member);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern Handle OpenProcess(uint access,bool inherit,uint pid);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref IntPtr size);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,UIntPtr attribute,IntPtr value,UIntPtr size,IntPtr previous,IntPtr returned);
        [DllImport("kernel32.dll")] internal static extern void DeleteProcThreadAttributeList(IntPtr list);
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] internal static extern bool CreateProcessW(string executable,StringBuilder command,IntPtr ps,IntPtr ts,bool inherit,uint flags,IntPtr environment,string directory,ref StartupEx startup,out ProcessInfo process);
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] internal static extern Handle CreateFileW(string file,uint access,uint share,ref Security security,uint disposition,uint flags,IntPtr template);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref Security security,uint size);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern uint ResumeThread(Handle thread);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern uint WaitForSingleObject(Handle handle,uint milliseconds);
        [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool GetExitCodeProcess(Handle process,out uint code);
        internal static Exception Error(string stage) { return new Win32Exception(Marshal.GetLastWin32Error(),stage); }
    }
    public sealed class Child : IDisposable {
        internal readonly Handle Process, Thread;
        internal readonly StreamWriter Input;
        public uint Id { get; private set; }
        public string Label { get; private set; }
        internal Child(Handle process,Handle thread,StreamWriter input,uint id,string label) { Process=process;Thread=thread;Input=input;Id=id;Label=label; }
        public bool Wait(int milliseconds) {
            if(milliseconds<0) throw new ArgumentOutOfRangeException("milliseconds");
            uint result=Native.WaitForSingleObject(Process,(uint)milliseconds);
            if(result==0) return true;
            if(result==258) return false;
            throw Native.Error("WAIT_FAILED");
        }
        public bool HasExited { get { return Wait(0); } }
        public uint ExitCode { get { if(!HasExited) throw new InvalidOperationException("STILL_RUNNING"); uint code; if(!Native.GetExitCodeProcess(Process,out code)) throw Native.Error("EXIT_QUERY_FAILED"); return code; } }
        public void Send(string line) { if(line.IndexOfAny(new[]{'\r','\n'})>=0) throw new ArgumentException("ONE_LINE_REQUIRED"); Input.WriteLine(line);Input.Flush(); }
        public void Dispose() { try { Input.Dispose(); } finally { Thread.Dispose();Process.Dispose(); } }
    }
    public sealed class Owner : IDisposable {
        readonly Handle job;
        readonly List<Child> children=new List<Child>();
        bool closed, terminal;
        public Owner() {
            if(!OperatingSystem.IsWindows() || RuntimeInformation.ProcessArchitecture!=Architecture.X64 || Marshal.SizeOf<Native.StartupEx>()!=112 || Marshal.SizeOf<Native.Extended>()!=144) throw new PlatformNotSupportedException("WINDOWS_X64_REQUIRED");
            job=Native.CreateJobObjectW(IntPtr.Zero,null);
            if(job.IsInvalid) throw Native.Error("JOB_CREATE_FAILED");
            var limits=new Native.Extended(); limits.Basic.Flags=0x2000; // KILL_ON_JOB_CLOSE, no breakaway.
            if(!Native.SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf<Native.Extended>())) { job.Dispose();throw Native.Error("JOB_CONFIG_FAILED"); }
        }
        public uint ActiveCount {
            get { Native.Accounting info; if(!Native.QueryInformationJobObject(job,1,out info,(uint)Marshal.SizeOf<Native.Accounting>(),IntPtr.Zero)) throw Native.Error("JOB_QUERY_FAILED"); return info.Active; }
        }
        public bool Owns(uint pid) {
            using(var process=Native.OpenProcess(0x1000,false,pid)) { bool member; return !process.IsInvalid && Native.IsProcessInJob(process,job,out member) && member; }
        }
        public bool WaitEmpty(int milliseconds) { var clock=Stopwatch.StartNew(); do { if(ActiveCount==0) return true;Thread.Sleep(25); } while(clock.ElapsedMilliseconds<milliseconds); return ActiveCount==0; }
        public void ForceStop() { terminal=true; if(!Native.TerminateJobObject(job,1)) throw Native.Error("JOB_TERMINATION_FAILED"); }
        public static string Quote(string text) {
            if(text==null || text.Contains('\0')) throw new ArgumentException("ARGUMENT_REJECTED");
            var result=new StringBuilder("\""); int slashes=0;
            foreach(char c in text) { if(c=='\\') { slashes++;continue; } result.Append('\\',c=='"'?slashes*2+1:slashes).Append(c);slashes=0; }
            return result.Append('\\',slashes*2).Append('"').ToString();
        }
        static Handle Output(string file) {
            var security=new Native.Security { Length=Marshal.SizeOf<Native.Security>(),Inherit=1 };
            var handle=Native.CreateFileW(file,0x40000000,1,ref security,1,0x80,IntPtr.Zero); // CREATE_NEW; no overwrite.
            if(handle.IsInvalid) { handle.Dispose();throw Native.Error("LOG_CREATE_FAILED"); } return handle;
        }
        public Child Start(string label,string executable,string[] arguments,string directory,IDictionary<string,string> environment,string output,string error) {
            if(closed || terminal) throw new InvalidOperationException("OWNER_CLOSED");
            if(!Path.IsPathFullyQualified(executable) || !File.Exists(executable) || !Path.IsPathFullyQualified(directory) || !Directory.Exists(directory)) throw new ArgumentException("EXECUTABLE_OR_DIRECTORY_REJECTED");
            var command=new StringBuilder(Quote(executable)); foreach(string argument in arguments) command.Append(' ').Append(Quote(argument));
            if(command.Length>=32767) throw new ArgumentException("COMMAND_TOO_LONG");
            var block=new StringBuilder();
            foreach(var pair in new SortedDictionary<string,string>(environment,StringComparer.OrdinalIgnoreCase)) {
                if(String.IsNullOrEmpty(pair.Key) || pair.Key.IndexOfAny(new[]{'=', '\0'})>=0 || pair.Value==null || pair.Value.Contains('\0')) throw new ArgumentException("ENVIRONMENT_REJECTED");
                block.Append(pair.Key).Append('=').Append(pair.Value).Append('\0');
            }
            block.Append('\0');if(environment.Count==0) block.Append('\0');
            byte[] bytes=Encoding.Unicode.GetBytes(block.ToString());
            IntPtr env=IntPtr.Zero,attrs=IntPtr.Zero,jobs=IntPtr.Zero,handles=IntPtr.Zero,pipeRead=IntPtr.Zero,pipeWrite=IntPtr.Zero;
            bool initialized=false,created=false,transferred=false;
            var ph=new Handle();var th=new Handle(); StreamWriter input=null;
            try {
                env=Marshal.AllocHGlobal(bytes.Length);Marshal.Copy(bytes,0,env,bytes.Length);
                IntPtr size=IntPtr.Zero;Native.InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);
                if(size==IntPtr.Zero) throw Native.Error("ATTRIBUTE_SIZE_FAILED");
                attrs=Marshal.AllocHGlobal(size);
                if(!Native.InitializeProcThreadAttributeList(attrs,2,0,ref size)) throw Native.Error("ATTRIBUTE_INIT_FAILED");initialized=true;
                jobs=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(jobs,job.DangerousGetHandle());
                if(!Native.UpdateProcThreadAttribute(attrs,0,new UIntPtr(0x2000D),jobs,new UIntPtr((uint)IntPtr.Size),IntPtr.Zero,IntPtr.Zero)) throw Native.Error("JOB_ATTRIBUTE_FAILED");
                var security=new Native.Security { Length=Marshal.SizeOf<Native.Security>(),Inherit=1 };
                if(!Native.CreatePipe(out pipeRead,out pipeWrite,ref security,0)) throw Native.Error("PIPE_CREATE_FAILED");
                if(!Native.SetHandleInformation(pipeWrite,1,0)) throw Native.Error("PIPE_INHERIT_FAILED");
                using(var stdout=Output(output)) using(var stderr=Output(error)) {
                    handles=Marshal.AllocHGlobal(3*IntPtr.Size);Marshal.WriteIntPtr(handles,pipeRead);Marshal.WriteIntPtr(handles,IntPtr.Size,stdout.DangerousGetHandle());Marshal.WriteIntPtr(handles,2*IntPtr.Size,stderr.DangerousGetHandle());
                    if(!Native.UpdateProcThreadAttribute(attrs,0,new UIntPtr(0x20002),handles,new UIntPtr((uint)(3*IntPtr.Size)),IntPtr.Zero,IntPtr.Zero)) throw Native.Error("HANDLE_ATTRIBUTE_FAILED");
                    var startup=new Native.StartupEx();startup.Startup.Size=(uint)Marshal.SizeOf<Native.StartupEx>();startup.Startup.Flags=0x100;startup.Startup.Input=pipeRead;startup.Startup.Output=stdout.DangerousGetHandle();startup.Startup.Error=stderr.DangerousGetHandle();startup.Attributes=attrs;
                    Native.ProcessInfo pi;
                    if(!Native.CreateProcessW(executable,command,IntPtr.Zero,IntPtr.Zero,true,0x08000000|0x00080000|0x400|0x4,env,directory,ref startup,out pi)) throw Native.Error("CONTAINED_CREATE_FAILED");
                    ph.Adopt(pi.Process);th.Adopt(pi.Thread);created=true;
                    var pipe=new SafeFileHandle(pipeWrite,true);pipeWrite=IntPtr.Zero;
                    input=new StreamWriter(new FileStream(pipe,FileAccess.Write),new UTF8Encoding(false));input.NewLine="\n";
                    var child=new Child(ph,th,input,pi.Id,label);children.Add(child);transferred=true;
                    bool member;if(!Native.IsProcessInJob(ph,job,out member) || !member) throw new InvalidOperationException("JOB_MEMBERSHIP_FAILED");
                    if(Native.ResumeThread(th)!=1) throw Native.Error("RESUME_FAILED");
                    th.Dispose();return child;
                }
            } catch { if(created) { try { ForceStop(); } catch { job.Dispose();closed=true; } } throw; }
            finally {
                if(!transferred) { if(input!=null) input.Dispose();ph.Dispose();th.Dispose(); }
                if(pipeRead!=IntPtr.Zero) Native.CloseHandle(pipeRead);if(pipeWrite!=IntPtr.Zero) Native.CloseHandle(pipeWrite);
                if(initialized) Native.DeleteProcThreadAttributeList(attrs);
                foreach(IntPtr pointer in new[]{attrs,jobs,handles}) if(pointer!=IntPtr.Zero) Marshal.FreeHGlobal(pointer);
                if(env!=IntPtr.Zero) { for(int i=0;i<bytes.Length;i++) Marshal.WriteByte(env,i,0);Marshal.FreeHGlobal(env); }Array.Clear(bytes,0,bytes.Length);
            }
        }
        public void Dispose() {
            if(closed)return;closed=true;
            try { job.Dispose(); }
            finally { foreach(var child in children) { try { child.Dispose(); } catch(IOException) { /* Already-closed private stdin; still dispose every native handle. */ } } }
        }
    }
}
