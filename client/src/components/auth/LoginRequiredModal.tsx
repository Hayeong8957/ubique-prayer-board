import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginRequiredModal({ open, onClose }: LoginRequiredModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-surface bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-textMain">로그인 후 이용 가능합니다.</h2>
        <p className="mb-4 text-sm text-textSub">기도제목 작성은 카카오 로그인 후 사용할 수 있어요.</p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            닫기
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => signIn("kakao", { callbackUrl: "/" })}
          >
            카카오 로그인하기
          </Button>
        </div>
      </div>
    </div>
  );
}
