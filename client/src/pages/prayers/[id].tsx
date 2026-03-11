import Link from "next/link";
import type { GetServerSideProps } from "next";
import { MessageCircle } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPostById, listCommentsByPostId } from "@/features/posts/server";
import type { CommentItem, PostDetail } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

interface PrayerDetailPageProps {
  post: PostDetail | null;
  comments: CommentItem[];
  error?: string;
}

function displayAuthor(name: string, isAnonymous: boolean) {
  return isAnonymous ? "익명의 지체" : name;
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

export default function PrayerDetailPage({ post, comments, error }: PrayerDetailPageProps) {
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
          <Link href="/" className="text-sm font-medium text-primary">
            ← 기도제목 목록으로
          </Link>
        </div>

        <Card className="mb-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-textMain">
              {displayAuthor(post.authorName, post.isAnonymous)}
            </p>
            <span className="text-xs text-textSub">{formatFullDate(post.createdAt)}</span>
          </div>
          <h1 className="mb-2 text-lg font-bold text-textMain">{post.title}</h1>
          <p className="mb-4 whitespace-pre-wrap text-[15px] text-textMain">{post.content}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={post.hasAmened ? "secondary" : "ghost"}>
              🙏 아멘 {post.amenCount}
            </Button>
            <Button size="sm" variant="ghost" className="gap-1">
              <MessageCircle className="h-4 w-4" />
              댓글 {post.commentCount}
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-textMain">댓글</p>
          {comments.length === 0 ? (
            <p className="text-sm text-textSub">아직 댓글이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-surface bg-surface/40 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold text-textMain">
                      {displayAuthor(comment.authorName, comment.isAnonymous)}
                    </p>
                    <span className="text-xs text-textSub">{formatFullDate(comment.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-textMain">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<PrayerDetailPageProps> = async (context) => {
  const postId = context.params?.id;
  if (typeof postId !== "string") {
    return { props: { post: null, comments: [], error: "잘못된 요청입니다." } };
  }

  try {
    const session = await getServerSession(context.req, context.res, authOptions);
    const [post, comments] = await Promise.all([
      getPostById(postId, session?.user?.id ?? null),
      listCommentsByPostId(postId),
    ]);
    return { props: { post, comments } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return { props: { post: null, comments: [], error: message } };
  }
};
