import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-md items-center px-4 py-10">
        <Card className="w-full p-5">
          <h1 className="mb-1 text-lg font-bold text-textMain">로그인</h1>
          <p className="mb-4 text-sm text-textSub">
            기도제목 작성, 수정, 삭제는 로그인 후 이용 가능합니다.
          </p>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => signIn("kakao", { callbackUrl: "/" })}
          >
            카카오 로그인하기
          </Button>
        </Card>
      </main>
    </div>
  );
}
