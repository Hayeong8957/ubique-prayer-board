import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPostById } from "@/features/posts/server";
import type { PostDetail } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

interface SermonDetailPageProps {
  post: PostDetail | null;
  canManage: boolean;
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

type UpdatePostResponse = { ok: true; data: { id: string } } | { ok: false; error: string };

export default function SermonDetailPage({ post, canManage, error }: SermonDetailPageProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(post?.title ?? "");
  const [scriptureText, setScriptureText] = useState(post?.scriptureText ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
  const postId = post.id;

  async function onSave() {
    if (!title.trim()) {
      setSubmitError("제목을 입력해주세요.");
      return;
    }
    if (!scriptureText.trim()) {
      setSubmitError("말씀을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      setSubmitError("본문을 입력해주세요.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, scriptureText, content }),
      });
      const payload = (await response.json()) as UpdatePostResponse;
      if (!response.ok || !payload.ok) {
        setSubmitError(payload.ok ? "수정 중 오류가 발생했습니다." : payload.error);
        return;
      }
      setIsEditing(false);
      await router.replace(router.asPath);
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDelete() {
    const ok = window.confirm("이 주일 말씀을 삭제할까요?");
    if (!ok) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      const payload = (await response.json()) as UpdatePostResponse;
      if (!response.ok || !payload.ok) {
        setSubmitError(payload.ok ? "삭제 중 오류가 발생했습니다." : payload.error);
        return;
      }
      await router.push("/?board=sermon");
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
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
          {isEditing ? (
            <>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="제목"
                className="mb-3 h-12 w-full rounded-xl border border-surface bg-white px-4 text-sm text-textMain"
              />
              <input
                value={scriptureText}
                onChange={(event) => setScriptureText(event.target.value)}
                placeholder="말씀"
                className="mb-3 h-12 w-full rounded-xl border border-surface bg-white px-4 text-sm text-textMain"
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="mb-4 min-h-[220px] w-full resize-none rounded-xl border border-surface bg-white px-4 py-4 text-[15px] text-textMain"
              />
            </>
          ) : (
            <>
              <h1 className="mb-2 text-lg font-bold text-textMain">{post.title}</h1>
              {post.scriptureText ? (
                <p className="mb-3 text-sm font-medium text-textSub">{post.scriptureText}</p>
              ) : null}
              <p className="mb-4 whitespace-pre-wrap text-[15px] text-textMain">{post.content}</p>
            </>
          )}
          {submitError ? <p className="mb-3 text-sm text-red-600">{submitError}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <Button size="sm" variant={post.hasAmened ? "secondary" : "ghost"}>
              🙏 아멘 {post.amenCount}
            </Button>
            {canManage ? (
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={onSave} disabled={isSubmitting}>
                      {isSubmitting ? "저장 중..." : "저장"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTitle(post.title);
                        setScriptureText(post.scriptureText ?? "");
                        setContent(post.content);
                        setSubmitError(null);
                        setIsEditing(false);
                      }}
                      disabled={isSubmitting}
                    >
                      취소
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      style={{ borderColor: "var(--ubique-primary)", color: "var(--ubique-primary)" }} 
                      onClick={() => setIsEditing(true)}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="border"
                      style={{ borderColor: "var(--ubique-fail)", color: "var(--ubique-fail)" }}
                      onClick={onDelete}
                      disabled={isSubmitting}
                    >
                      삭제
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </Card>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<SermonDetailPageProps> = async (context) => {
  const postId = context.params?.id;
  if (typeof postId !== "string") {
    return { props: { post: null, canManage: false, error: "잘못된 요청입니다." } };
  }

  try {
    const session = await getServerSession(context.req, context.res, authOptions);
    const post = await getPostById(postId, session?.user?.id ?? null);
    if (!post || post.boardCode !== "sermon") {
      return { props: { post: null, canManage: false, error: "주일 말씀 게시글이 아닙니다." } };
    }
    return {
      props: {
        post,
        canManage: Boolean(post && session?.user?.id && post.authorUserId === session.user.id),
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return { props: { post: null, canManage: false, error: message } };
  }
};
