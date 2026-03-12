import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { Card } from "@/components/ui/card";
import { authOptions } from "@/lib/auth/options";
import { listPostsByAuthorAndBoardCode } from "@/features/posts/server";
import type { PostListItem } from "@/features/posts/types";

interface ProfilePageProps {
  prayerPosts: PostListItem[];
  sermonPosts: PostListItem[];
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

function groupByDate(posts: PostListItem[]) {
  return posts.reduce<Record<string, PostListItem[]>>((acc, post) => {
    const key = dateKey(post.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});
}

export default function ProfilePage({ prayerPosts, sermonPosts, error }: ProfilePageProps) {
  const groupedPrayers = groupByDate(prayerPosts);
  const groupedSermons = groupByDate(sermonPosts);
  const prayerGroupKeys = Object.keys(groupedPrayers).sort((a, b) => (a < b ? 1 : -1));
  const sermonGroupKeys = Object.keys(groupedSermons).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="min-h-screen bg-background pb-10">
      <main className="mx-auto w-full max-w-2xl px-4 pt-4">
        <div className="mb-3">
          <Link href="/" className="text-sm font-medium text-primary">
            ← 홈으로
          </Link>
        </div>
        
        <div>
          <h1 className="mb-1 text-lg font-bold text-textMain">내 프로필</h1>
          <p className="mb-4 text-sm text-textSub">내가 작성한 기도제목과 주일 말씀</p>
        </div>

        {error ? (
          <Card className="mb-3 p-4">
            <p className="text-sm text-red-600">목록을 불러오지 못했습니다: {error}</p>
          </Card>
        ) : null}

        {!error && prayerPosts.length === 0 && sermonPosts.length === 0 ? (
          <Card className="mb-3 p-4">
            <p className="text-sm text-textSub">아직 작성한 글이 없습니다.</p>
          </Card>
        ) : null}

        {!error ? (
          <div className="space-y-3">
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-textMain">내 기도제목</h2>
              {prayerGroupKeys.length === 0 ? (
                <p className="text-sm text-textSub">작성한 기도제목이 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  {prayerGroupKeys.map((key) => (
                    <section key={`prayer-${key}`}>
                      <h3 className="mb-2 text-xs font-semibold text-textSub">{dateLabel(key)}</h3>
                      <div className="space-y-2">
                        {groupedPrayers[key].map((post) => (
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
              )}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-textMain">내 주일 말씀</h2>
              {sermonGroupKeys.length === 0 ? (
                <p className="text-sm text-textSub">작성한 주일 말씀이 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  {sermonGroupKeys.map((key) => (
                    <section key={`sermon-${key}`}>
                      <h3 className="mb-2 text-xs font-semibold text-textSub">{dateLabel(key)}</h3>
                      <div className="space-y-2">
                        {groupedSermons[key].map((post) => (
                          <Link
                            key={post.id}
                            href={`/sermons/${post.id}`}
                            className="block rounded-xl border border-surface bg-surface/40 p-3 transition hover:bg-surface"
                          >
                            <p className="mb-1 text-sm font-semibold text-textMain">{post.title}</p>
                            {post.scriptureText ? (
                              <p className="line-clamp-1 text-sm text-textSub">{post.scriptureText}</p>
                            ) : null}
                            <p className="mt-2 text-xs text-textSub">
                              {timeLabel(post.createdAt)} · 댓글 {post.commentCount}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}
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
    const [prayerPosts, sermonPosts] = await Promise.all([
      listPostsByAuthorAndBoardCode(session.user.id, "prayer"),
      listPostsByAuthorAndBoardCode(session.user.id, "sermon"),
    ]);
    return { props: { prayerPosts, sermonPosts } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return { props: { prayerPosts: [], sermonPosts: [], error: message } };
  }
};
