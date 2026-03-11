import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto w-full max-w-md">
        <Card className="p-5 text-center">
          <h1 className="mb-2 text-lg font-bold text-textMain">오프라인 상태예요</h1>
          <p className="mb-4 text-sm text-textSub">
            네트워크 연결을 확인한 뒤 다시 시도해 주세요.
          </p>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-primary bg-primary px-5 text-sm font-semibold text-white"
          >
            홈으로 이동
          </Link>
        </Card>
      </main>
    </div>
  );
}
