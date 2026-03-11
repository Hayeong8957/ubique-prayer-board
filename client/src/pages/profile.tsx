import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { Card } from "@/components/ui/card";
import { authOptions } from "@/lib/auth/options";
import { listPostsByAuthorAndBoardCode } from "@/features/posts/server";
import type { PostListItem } from "@/features/posts/types";

interface ProfilePageProps {
  posts: PostListItem[];
  error?: string;
}

function dateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateLabel(key: string) {
  if (key === "unknown") return "날짜 확인 불가";
  const [y, m, d] = key.split("-");
  return `${y}년 ${m}월 ${d}일`;
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

export default function ProfilePage({ posts, error }: ProfilePageProps) {
  const grouped = posts.reduce<Record<string, PostListItem[]>>((acc, post) => {
    const key = dateKey(post.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="min-h-screen bg-background pb-10">
      <main className="mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="mb-3">
          <Link href="/" className="text-sm font-medium text-primary">
            ← 홈으로
          </Link>
        </div>

        <Card className="p-4">
          <h1 className="mb-1 text-lg font-bold text-textMain">내 프로필</h1>
          <p className="mb-4 text-sm text-textSub">내가 작성한 과거 기도제목</p>

          {error ? (
            <p className="text-sm text-red-600">목록을 불러오지 못했습니다: {error}</p>
          ) : null}

          {!error && posts.length === 0 ? (
            <p className="text-sm text-textSub">아직 작성한 기도제목이 없습니다.</p>
          ) : null}

          {!error && groupKeys.length > 0 ? (
            <div className="space-y-4">
              {groupKeys.map((key) => (
                <section key={key}>
                  <h2 className="mb-2 text-xs font-semibold text-textSub">{dateLabel(key)}</h2>
                  <div className="space-y-2">
                    {grouped[key].map((post) => (
                      <Link
                        key={post.id}
                        href={`/prayers/${post.id}`}
                        className="block rounded-xl border border-surface bg-surface/40 p-3 transition hover:bg-surface"
                      >
                        <p className="mb-1 text-sm font-semibold text-textMain">{post.title}</p>
                        <p className="line-clamp-2 text-sm text-textSub">{post.content}</p>
                        <p className="mt-2 text-xs text-textSub">
                          {timeLabel(post.createdAt)} · 댓글 {post.commentCount}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </Card>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  try {
    const posts = await listPostsByAuthorAndBoardCode(session.user.id, "prayer");
    return { props: { posts } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return { props: { posts: [], error: message } };
  }
};
