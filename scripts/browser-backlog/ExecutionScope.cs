using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace DeepLearnerQa {
    // Temporary process-owned requests, never a power-plan/registry change.
    // Explicit user sleep still takes precedence. Cleared/closed on every exit.
    public sealed class ExecutionScope : IDisposable {
        [StructLayout(LayoutKind.Sequential)]
        struct Reason { public uint Version,Flags; public IntPtr Simple,Reserved1,Reserved2; }
        [StructLayout(LayoutKind.Sequential)]
        struct PowerStatus { public byte Ac,Battery,Percent,Flags; public uint Life,FullLife; }
        [DllImport("kernel32.dll",SetLastError=true)]
        static extern SafeFileHandle PowerCreateRequest(ref Reason reason);
        [DllImport("kernel32.dll",SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        static extern bool PowerSetRequest(SafeFileHandle request,int type);
        [DllImport("kernel32.dll",SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        static extern bool PowerClearRequest(SafeFileHandle request,int type);
        [DllImport("kernel32.dll",SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        static extern bool GetSystemPowerStatus(out PowerStatus status);
        SafeFileHandle handle;
        bool system,execution;
        public bool Released {get;private set;}
        public int ReleaseError {get;private set;}
        public static void RequireAc() {
            PowerStatus status;
            if(!GetSystemPowerStatus(out status)) throw new Win32Exception(Marshal.GetLastWin32Error(),"QA_POWER_STATUS_FAILED");
            if(status.Ac!=1) throw new InvalidOperationException("QA_AC_POWER_REQUIRED");
        }
        public ExecutionScope() {
            // REASON_CONTEXT's detailed union occupies 24 bytes on this qualified host.
            if(IntPtr.Size!=8) throw new InvalidOperationException("QA_POWER_ARCHITECTURE_REFUSED");
            RequireAc();
            IntPtr text=Marshal.StringToHGlobalUni("DeepLearner bounded synthetic browser QA");
            try {
                var reason=new Reason{Version=0,Flags=1,Simple=text};
                handle=PowerCreateRequest(ref reason);
                if(handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error(),"QA_POWER_REQUEST_CREATE_FAILED");
                if(!PowerSetRequest(handle,1)) throw new Win32Exception(Marshal.GetLastWin32Error(),"QA_POWER_SYSTEM_REQUEST_FAILED");
                system=true;
                if(!PowerSetRequest(handle,3)) throw new Win32Exception(Marshal.GetLastWin32Error(),"QA_POWER_EXECUTION_REQUEST_FAILED");
                execution=true;
            } catch { Dispose();throw; }
            finally { Marshal.FreeHGlobal(text); }
        }
        public void Dispose() {
            if(handle==null || handle.IsClosed) return;
            bool cleared=true;
            try {
                if(execution && !PowerClearRequest(handle,3)){ReleaseError=Marshal.GetLastWin32Error();cleared=false;}
                if(system && !PowerClearRequest(handle,1)){ReleaseError=Marshal.GetLastWin32Error();cleared=false;}
            } catch {cleared=false;ReleaseError=-1;}
            finally {handle.Dispose();Released=cleared && handle.IsClosed;}
        }
    }
}
