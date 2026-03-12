import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPostById } from "@/features/posts/server";
import type { PostDetail } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

interface SermonDetailPageProps {
  post: PostDetail | null;
  error?: string;
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

export default function SermonDetailPage({ post, error }: SermonDetailPageProps) {
  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Card className="border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</Card>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Card className="p-5 text-sm text-textSub">게시글을 찾을 수 없습니다.</Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <main className="mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="mb-3">
          <Link href="/?board=sermon" className="text-sm font-medium text-primary">
            ← 주일 말씀 목록으로
          </Link>
        </div>

        <Card className="mb-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-textMain">{post.authorName}</p>
            <span className="text-xs text-textSub">{formatFullDate(post.createdAt)}</span>
          </div>
          <h1 className="mb-2 text-lg font-bold text-textMain">{post.title}</h1>
          {post.scriptureText ? (
            <p className="mb-3 text-sm font-medium text-textSub">{post.scriptureText}</p>
          ) : null}
          <p className="mb-4 whitespace-pre-wrap text-[15px] text-textMain">{post.content}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={post.hasAmened ? "secondary" : "ghost"}>
              🙏 아멘 {post.amenCount}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<SermonDetailPageProps> = async (context) => {
  const postId = context.params?.id;
  if (typeof postId !== "string") {
    return { props: { post: null, error: "잘못된 요청입니다." } };
  }

  try {
    const session = await getServerSession(context.req, context.res, authOptions);
    const post = await getPostById(postId, session?.user?.id ?? null);
    if (!post || post.boardCode !== "sermon") {
      return { props: { post: null, error: "주일 말씀 게시글이 아닙니다." } };
    }
    return { props: { post } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return { props: { post: null, error: message } };
  }
};
