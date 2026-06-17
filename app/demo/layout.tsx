import { DemoStreamsProvider } from "@/components/streams-provider";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <DemoStreamsProvider>{children}</DemoStreamsProvider>;
}
