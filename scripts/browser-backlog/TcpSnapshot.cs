using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Net;
using System.Runtime.InteropServices;

namespace DeepLearnerQa {
    // Read-only IP Helper snapshot. This is metadata, never process authority.
    public sealed class TcpListenerRow {
        public string LocalAddress { get; }
        public int LocalPort { get; }
        public uint OwningProcess { get; }
        public TcpListenerRow(string address, int port, uint pid) {
            LocalAddress=address; LocalPort=port; OwningProcess=pid;
        }
    }
    public static class TcpSnapshot {
        private const int Capacity=1024*1024;
        [DllImport("iphlpapi.dll", ExactSpelling=true)]
        private static extern uint GetExtendedTcpTable(IntPtr table, ref uint size,
            [MarshalAs(UnmanagedType.Bool)] bool sort, uint family, uint tableClass, uint reserved);
        public static TcpListenerRow[] Parse(byte[] bytes, bool ipv6) {
            int stride=ipv6?56:24;
            if(bytes==null || bytes.Length<4 || bytes.Length>Capacity) throw new InvalidOperationException("QA_TCP_TABLE_INVALID");
            uint count=BitConverter.ToUInt32(bytes,0);
            if(count>(bytes.Length-4)/stride) throw new InvalidOperationException("QA_TCP_TABLE_INVALID");
            var rows=new List<TcpListenerRow>();
            for(int i=0;i<count;i++) {
                int start=4+i*stride, port=start+(ipv6?20:8);
                uint state=BitConverter.ToUInt32(bytes,start+(ipv6?48:0));
                uint pid=BitConverter.ToUInt32(bytes,start+(ipv6?52:20));
                if(state!=2 || pid==0) throw new InvalidOperationException("QA_TCP_LISTENER_INVALID");
                int number=(bytes[port]<<8)|bytes[port+1];
                if(number==0) throw new InvalidOperationException("QA_TCP_LISTENER_INVALID");
                var address=new byte[ipv6?16:4];
                Buffer.BlockCopy(bytes,start+(ipv6?0:4),address,0,address.Length);
                long scope=ipv6?(uint)IPAddress.NetworkToHostOrder(BitConverter.ToInt32(bytes,start+16)):0;
                string text=(ipv6?new IPAddress(address,scope):new IPAddress(address)).ToString();
                rows.Add(new TcpListenerRow(text,number,pid));
            }
            return rows.ToArray();
        }
        public static TcpListenerRow[] Read() {
            var rows=new List<TcpListenerRow>();
            IntPtr buffer=Marshal.AllocHGlobal(Capacity);
            try {
                foreach(uint family in new uint[]{2,23}) {
                    uint size=Capacity;
                    uint error=GetExtendedTcpTable(buffer,ref size,false,family,3,0);
                    if(error!=0) throw new Win32Exception((int)error,"QA_TCP_SNAPSHOT_FAILED");
                    if(size<4 || size>Capacity) throw new InvalidOperationException("QA_TCP_TABLE_INVALID");
                    var bytes=new byte[size]; Marshal.Copy(buffer,bytes,0,(int)size);
                    rows.AddRange(Parse(bytes,family==23));
                }
            } finally { Marshal.FreeHGlobal(buffer); }
            return rows.ToArray();
        }
    }
}
