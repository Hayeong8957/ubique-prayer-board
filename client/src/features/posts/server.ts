import { getSupabaseAdmin } from "@/lib/supabase/server";
import { POST_IMAGES_BUCKET } from "@/features/posts/images.server";
import type {
  BoardCode,
  CommentItem,
  CommentPagination,
  CreatePostInput,
  PostDetail,
  PostImageItem,
  PostListItem,
  UpdatePostInput,
} from "@/features/posts/types";

type BoardRow = { id: string; code: string };
type PostRow = {
  id: string;
  board_id: string;
  author_user_id: string;
  title: string;
  scripture_text: string | null;
  content: string | null;
  image_urls: string[] | null;
  status: "draft" | "published";
  published_at: string | null;
  is_anonymous: boolean;
  is_pinned: boolean;
  comment_count: number;
  amen_count: number;
  created_at: string;
  author: { name: string } | null;
};
type PostDetailRow = PostRow & { board: { code: BoardCode } | null };
type EditablePostRow = {
  id: string;
  author_user_id: string;
  status: "draft" | "published";
  published_at: string | null;
  board: { code: BoardCode } | null;
};
type PostImageRow = {
  id: string;
  post_id: string;
  object_path: string | null;
  public_url: string;
  sort_order: number;
};
type InsertedPostRow = { id: string };
type DraftPostRow = { id: string };
type AmenStateRow = { post_id: string };
type AmenCountRow = { amen_count: number };
type CommentRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  author: { name: string } | null;
};
type InsertedCommentRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  author: { name: string } | null;
};
type EditableCommentRow = {
  id: string;
  post_id: string;
  author_user_id: string;
};

const MAX_POST_IMAGE_COUNT = 4;

function createTitleFromContent(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!compact) return "기도제목";
  return compact.length > 30 ? `${compact.slice(0, 30)}...` : compact;
}

function mapPostImage(image: PostImageRow): PostImageItem {
  return {
    id: image.id,
    publicUrl: image.public_url,
    sortOrder: image.sort_order,
  };
}

function mergeImageUrls(images: PostImageItem[], legacyImageUrls: string[] | null | undefined) {
  if (images.length > 0) {
    return images.map((image) => image.publicUrl);
  }
  return (legacyImageUrls ?? []).filter(Boolean);
}

function uniqueImageIds(imageIds: string[] | undefined) {
  if (!imageIds) return undefined;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const imageId of imageIds) {
    if (!imageId || seen.has(imageId)) continue;
    ids.push(imageId);
    seen.add(imageId);
  }
  return ids;
}

async function listPostImageRowsByPostIds(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, PostImageRow[]>();

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("post_images")
    .select("id,post_id,object_path,public_url,sort_order")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<PostImageRow[]>();

  if (error) {
    throw new Error(`Failed to load post images: ${error.message}`);
  }

  const rowsByPostId = new Map<string, PostImageRow[]>();
  for (const row of data ?? []) {
    const existing = rowsByPostId.get(row.post_id) ?? [];
    existing.push(row);
    rowsByPostId.set(row.post_id, existing);
  }
  return rowsByPostId;
}

async function listPostImagesByPostId(postId: string) {
  const rowsByPostId = await listPostImageRowsByPostIds([postId]);
  return (rowsByPostId.get(postId) ?? []).map(mapPostImage);
}

async function listEditablePostImageRows(postId: string) {
  const rowsByPostId = await listPostImageRowsByPostIds([postId]);
  return rowsByPostId.get(postId) ?? [];
}

async function removePostImageObjects(objectPaths: string[]) {
  const paths = objectPaths.filter(Boolean);
  if (paths.length === 0) return;

  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.storage.from(POST_IMAGES_BUCKET).remove(paths);
}

export async function getBoardByCode(boardCode: BoardCode) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("boards")
    .select("id,code")
    .eq("code", boardCode)
    .eq("is_active", true)
    .maybeSingle<BoardRow>();

  if (error) {
    throw new Error(`Failed to load board: ${error.message}`);
  }

  return data;
}

export async function listPostsByBoardCode(boardCode: BoardCode): Promise<PostListItem[]> {
  const result = await listPostsByBoardCodePaginated(boardCode, 1, 30, null);
  return result.items;
}

export async function listPostsByBoardCodePaginated(
  boardCode: BoardCode,
  page: number,
  pageSize: number,
  viewerUserId: string | null
): Promise<{ items: PostListItem[]; hasMore: boolean }> {
  const board = await getBoardByCode(boardCode);
  if (!board) return { items: [], hasMore: false };

  const supabaseAdmin = getSupabaseAdmin();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 30) : 10;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;

  const listSelectColumns =
    boardCode === "sermon"
      ? "id,board_id,author_user_id,title,scripture_text,image_urls,status,published_at,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name)"
      : "id,board_id,author_user_id,title,scripture_text,content,image_urls,status,published_at,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name)";

  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(listSelectColumns)
    .eq("board_id", board.id)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("is_pinned", { ascending: false })
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<PostRow[]>();

  if (error) {
    throw new Error(`Failed to load posts: ${error.message}`);
  }

  const rows = data ?? [];
  const visibleRows = rows.slice(0, safePageSize);
  const postIds = visibleRows.map((post) => post.id);
  const imageRowsByPostId = await listPostImageRowsByPostIds(postIds);
  const amenedPostIdSet = new Set<string>();

  if (viewerUserId && postIds.length > 0) {
    const { data: amenRows, error: amenError } = await supabaseAdmin
      .from("post_amens")
      .select("post_id")
      .eq("user_id", viewerUserId)
      .in("post_id", postIds)
      .returns<AmenStateRow[]>();

    if (amenError) {
      throw new Error(`Failed to load amen states: ${amenError.message}`);
    }
    for (const row of amenRows ?? []) {
      amenedPostIdSet.add(row.post_id);
    }
  }

  return {
    items: visibleRows.map((post) => {
      const images = (imageRowsByPostId.get(post.id) ?? []).map(mapPostImage);
      return {
        id: post.id,
        title: post.title,
        scriptureText: post.scripture_text,
        content: post.content ?? "",
        imageUrls: mergeImageUrls(images, post.image_urls),
        isAnonymous: post.is_anonymous,
        isPinned: post.is_pinned,
        commentCount: post.comment_count,
        amenCount: post.amen_count,
        hasAmened: amenedPostIdSet.has(post.id),
        createdAt: post.created_at,
        authorName: post.author?.name ?? "알 수 없음",
      };
    }),
    hasMore: rows.length > safePageSize,
  };
}

export async function listPostsByAuthorAndBoardCode(
  authorUserId: string,
  boardCode: BoardCode
): Promise<PostListItem[]> {
  const board = await getBoardByCode(boardCode);
  if (!board) return [];

  const supabaseAdmin = getSupabaseAdmin();
  const listSelectColumns =
    boardCode === "sermon"
      ? "id,board_id,author_user_id,title,scripture_text,image_urls,status,published_at,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name)"
      : "id,board_id,author_user_id,title,scripture_text,content,image_urls,status,published_at,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name)";

  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(listSelectColumns)
    .eq("author_user_id", authorUserId)
    .eq("board_id", board.id)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<PostRow[]>();

  if (error) {
    throw new Error(`Failed to load my posts: ${error.message}`);
  }

  const rows = data ?? [];
  const imageRowsByPostId = await listPostImageRowsByPostIds(rows.map((post) => post.id));

  return rows.map((post) => {
    const images = (imageRowsByPostId.get(post.id) ?? []).map(mapPostImage);
    return {
      id: post.id,
      title: post.title,
      scriptureText: post.scripture_text,
      content: post.content ?? "",
      imageUrls: mergeImageUrls(images, post.image_urls),
      isAnonymous: post.is_anonymous,
      isPinned: post.is_pinned,
      commentCount: post.comment_count,
      amenCount: post.amen_count,
      hasAmened: false,
      createdAt: post.created_at,
      authorName: post.author?.name ?? "알 수 없음",
    };
  });
}

export async function getPostById(
  postId: string,
  viewerUserId?: string | null
): Promise<PostDetail | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const postPromise = supabaseAdmin
    .from("posts")
    .select(
      "id,board_id,author_user_id,title,scripture_text,content,image_urls,status,published_at,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name),board:boards!posts_board_id_fkey(code)"
    )
    .eq("id", postId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle<PostDetailRow>();
  const imagesPromise = listPostImagesByPostId(postId);
  const amenPromise = viewerUserId
    ? supabaseAdmin
        .from("post_amens")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", viewerUserId)
        .maybeSingle<AmenStateRow>()
    : null;

  const [postResult, images, amenResult] = await Promise.all([
    postPromise,
    imagesPromise,
    amenPromise ?? Promise.resolve({ data: null, error: null }),
  ]);

  const { data, error } = postResult;
  if (error) {
    throw new Error(`Failed to load post: ${error.message}`);
  }
  if (!data || !data.board) return null;

  const amenError = amenResult?.error ?? null;
  if (amenError) {
    throw new Error(`Failed to load amen state: ${amenError.message}`);
  }

  return {
    id: data.id,
    boardCode: data.board.code,
    authorUserId: data.author_user_id,
    title: data.title,
    scriptureText: data.scripture_text,
    content: data.content ?? "",
    imageUrls: mergeImageUrls(images, data.image_urls),
    images,
    status: data.status,
    isAnonymous: data.is_anonymous,
    isPinned: data.is_pinned,
    commentCount: data.comment_count,
    amenCount: data.amen_count,
    hasAmened: Boolean(amenResult?.data),
    createdAt: data.created_at,
    authorName: data.author?.name ?? "알 수 없음",
  };
}

function mapComment(comment: CommentRow | InsertedCommentRow): CommentItem {
  return {
    id: comment.id,
    postId: comment.post_id,
    authorUserId: comment.author_user_id,
    content: comment.content,
    isAnonymous: comment.is_anonymous,
    createdAt: comment.created_at,
    authorName: comment.author?.name ?? "알 수 없음",
  };
}

export async function listCommentsByPostIdPaginated(
  postId: string,
  page: number,
  pageSize: number
): Promise<{ items: CommentItem[]; pagination: CommentPagination }> {
  const supabaseAdmin = getSupabaseAdmin();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 20) : 5;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;

  const { data, error } = await supabaseAdmin
    .from("comments")
    .select(
      "id,post_id,author_user_id,content,is_anonymous,created_at,author:users!comments_author_user_id_fkey(name)"
    )
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<CommentRow[]>();

  if (error) {
    throw new Error(`Failed to load comments: ${error.message}`);
  }

  const rows = data ?? [];
  const pageRows = rows.slice(0, safePageSize).reverse();

  return {
    items: pageRows.map(mapComment),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      hasMore: rows.length > safePageSize,
      nextPage: rows.length > safePageSize ? safePage + 1 : null,
    },
  };
}

async function ensureVisiblePost(postId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`Failed to load post for comment: ${error.message}`);
  }

  return data;
}

export async function createComment(input: {
  postId: string;
  authorUserId: string;
  content: string;
  isAnonymous?: boolean;
}): Promise<CommentItem> {
  const post = await ensureVisiblePost(input.postId);
  if (!post) {
    throw new Error("POST_NOT_FOUND");
  }

  const content = input.content.trim();
  if (!content) {
    throw new Error("Content is required");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert({
      post_id: input.postId,
      author_user_id: input.authorUserId,
      content,
      is_anonymous: input.isAnonymous ?? false,
    })
    .select(
      "id,post_id,author_user_id,content,is_anonymous,created_at,author:users!comments_author_user_id_fkey(name)"
    )
    .single<InsertedCommentRow>();

  if (error || !data) {
    throw new Error(`Failed to create comment: ${error?.message ?? "unknown error"}`);
  }

  return mapComment(data);
}

async function getEditableCommentById(commentId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id,post_id,author_user_id")
    .eq("id", commentId)
    .is("deleted_at", null)
    .maybeSingle<EditableCommentRow>();

  if (error) {
    throw new Error(`Failed to load comment: ${error.message}`);
  }

  return data;
}

export async function updateCommentById(input: {
  commentId: string;
  postId: string;
  authorUserId: string;
  content: string;
}): Promise<CommentItem> {
  const comment = await getEditableCommentById(input.commentId);
  if (!comment || comment.post_id !== input.postId) {
    throw new Error("COMMENT_NOT_FOUND");
  }
  if (comment.author_user_id !== input.authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const content = input.content.trim();
  if (!content) {
    throw new Error("Content is required");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("comments")
    .update({ content })
    .eq("id", input.commentId)
    .eq("author_user_id", input.authorUserId)
    .eq("post_id", input.postId)
    .is("deleted_at", null)
    .select(
      "id,post_id,author_user_id,content,is_anonymous,created_at,author:users!comments_author_user_id_fkey(name)"
    )
    .single<InsertedCommentRow>();

  if (error || !data) {
    throw new Error(`Failed to update comment: ${error?.message ?? "unknown error"}`);
  }

  return mapComment(data);
}

export async function softDeleteCommentById(input: {
  commentId: string;
  postId: string;
  authorUserId: string;
}) {
  const comment = await getEditableCommentById(input.commentId);
  if (!comment || comment.post_id !== input.postId) {
    throw new Error("COMMENT_NOT_FOUND");
  }
  if (comment.author_user_id !== input.authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("comments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: input.authorUserId,
    })
    .eq("id", input.commentId)
    .eq("author_user_id", input.authorUserId)
    .eq("post_id", input.postId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
}

export async function listCommentsByPostId(postId: string): Promise<CommentItem[]> {
  const result = await listCommentsByPostIdPaginated(postId, 1, 100);
  return result.items;
}

export async function createDraftPost(input: {
  boardCode: BoardCode;
  authorUserId: string;
}): Promise<string> {
  const board = await getBoardByCode(input.boardCode);
  if (!board) {
    throw new Error("Board not found");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert({
      board_id: board.id,
      title: input.boardCode === "sermon" ? "" : "기도제목",
      scripture_text: null,
      content: "",
      image_urls: [],
      author_user_id: input.authorUserId,
      is_anonymous: input.boardCode === "prayer",
      status: "draft",
      published_at: null,
      amen_count: 0,
    })
    .select("id")
    .single<DraftPostRow>();

  if (error || !data) {
    throw new Error(`Failed to create draft: ${error?.message ?? "unknown error"}`);
  }

  return data.id;
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const board = await getBoardByCode(input.boardCode);
  if (!board) {
    throw new Error("Board not found");
  }

  const content = input.content.trim();
  if (!content) {
    throw new Error("Content is required");
  }

  const scriptureText = (input.scriptureText ?? "").trim();
  const titleInput = (input.title ?? "").trim();
  const title =
    input.boardCode === "sermon"
      ? titleInput
      : titleInput || createTitleFromContent(content);

  if (input.boardCode === "sermon") {
    if (!title) throw new Error("Title is required");
    if (!scriptureText) throw new Error("Scripture text is required");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publishedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert({
      board_id: board.id,
      title,
      scripture_text: scriptureText || null,
      content,
      image_urls: [],
      author_user_id: input.authorUserId,
      is_anonymous: input.boardCode === "prayer" ? input.isAnonymous : false,
      status: "published",
      published_at: publishedAt,
      amen_count: 0,
    })
    .select("id")
    .single<InsertedPostRow>();

  if (error || !data) {
    throw new Error(`Failed to create post: ${error?.message ?? "unknown error"}`);
  }

  return data.id;
}

async function getEditablePostById(postId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id,author_user_id,status,published_at,board:boards!posts_board_id_fkey(code)")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle<EditablePostRow>();

  if (error) {
    throw new Error(`Failed to load post: ${error.message}`);
  }
  return data;
}

export async function attachImageToPost(input: {
  postId: string;
  authorUserId: string;
  objectPath: string | null;
  publicUrl: string;
}): Promise<PostImageItem> {
  const post = await getEditablePostById(input.postId);
  if (!post || !post.board) {
    throw new Error("POST_NOT_FOUND");
  }
  if (post.author_user_id !== input.authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const existingRows = await listEditablePostImageRows(input.postId);
  if (existingRows.length >= MAX_POST_IMAGE_COUNT) {
    throw new Error("IMAGE_LIMIT_EXCEEDED");
  }

  const nextSortOrder = existingRows.length > 0 ? existingRows[existingRows.length - 1].sort_order + 1 : 0;
  const { data, error } = await supabaseAdmin
    .from("post_images")
    .insert({
      post_id: input.postId,
      object_path: input.objectPath,
      public_url: input.publicUrl,
      sort_order: nextSortOrder,
    })
    .select("id,post_id,object_path,public_url,sort_order")
    .single<PostImageRow>();

  if (error || !data) {
    throw new Error(`Failed to attach image: ${error?.message ?? "unknown error"}`);
  }

  const finalImageUrls = [...existingRows.map((row) => row.public_url), data.public_url];
  const { error: syncError } = await supabaseAdmin
    .from("posts")
    .update({ image_urls: finalImageUrls })
    .eq("id", input.postId);

  if (syncError) {
    throw new Error(`Failed to sync post images: ${syncError.message}`);
  }

  return mapPostImage(data);
}

export async function detachImageFromPost(input: {
  postId: string;
  imageId: string;
  authorUserId: string;
}) {
  const post = await getEditablePostById(input.postId);
  if (!post || !post.board) {
    throw new Error("POST_NOT_FOUND");
  }
  if (post.author_user_id !== input.authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const existingImageRows = await listEditablePostImageRows(input.postId);
  const targetImage = existingImageRows.find((image) => image.id === input.imageId);
  if (!targetImage) {
    throw new Error("IMAGE_NOT_FOUND");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("post_images")
    .delete()
    .eq("id", input.imageId)
    .eq("post_id", input.postId);

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }

  if (targetImage.object_path) {
    await removePostImageObjects([targetImage.object_path]);
  }

  const remainingImages = existingImageRows.filter((image) => image.id !== input.imageId);
  await Promise.all(
    remainingImages.map((image, index) =>
      supabaseAdmin
        .from("post_images")
        .update({ sort_order: index })
        .eq("id", image.id)
        .eq("post_id", input.postId)
    )
  );

  const { error: syncError } = await supabaseAdmin
    .from("posts")
    .update({
      image_urls: remainingImages.map((image) => image.public_url),
    })
    .eq("id", input.postId);

  if (syncError) {
    throw new Error(`Failed to sync post images: ${syncError.message}`);
  }
}

export async function updatePostById(input: UpdatePostInput) {
  const post = await getEditablePostById(input.postId);
  if (!post || !post.board) {
    throw new Error("POST_NOT_FOUND");
  }
  if (post.author_user_id !== input.authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const content = input.content.trim();
  if (!content) {
    throw new Error("Content is required");
  }

  const existingImageRows = await listEditablePostImageRows(input.postId);
  const requestedImageIds = uniqueImageIds(input.imageIds) ?? existingImageRows.map((image) => image.id);
  if (requestedImageIds.length > MAX_POST_IMAGE_COUNT) {
    throw new Error("Image limit exceeded");
  }

  const imageRowsById = new Map(existingImageRows.map((image) => [image.id, image]));
  const finalImageRows = requestedImageIds.map((imageId) => {
    const image = imageRowsById.get(imageId);
    if (!image) {
      throw new Error("INVALID_IMAGE_IDS");
    }
    return image;
  });
  const removedImageRows = existingImageRows.filter((image) => !requestedImageIds.includes(image.id));

  const updatePayload: {
    title?: string;
    scripture_text?: string | null;
    content: string;
    image_urls: string[];
    is_anonymous?: boolean;
    status: "published";
    published_at: string;
  } = {
    content,
    image_urls: finalImageRows.map((image) => image.public_url),
    status: "published",
    published_at: post.published_at ?? new Date().toISOString(),
  };

  if (post.board.code === "sermon") {
    const title = (input.title ?? "").trim();
    const scriptureText = (input.scriptureText ?? "").trim();
    if (!title) throw new Error("Title is required");
    if (!scriptureText) throw new Error("Scripture text is required");
    updatePayload.title = title;
    updatePayload.scripture_text = scriptureText;
    updatePayload.is_anonymous = false;
  } else {
    updatePayload.title = createTitleFromContent(content);
    updatePayload.scripture_text = null;
    if (typeof input.isAnonymous === "boolean") {
      updatePayload.is_anonymous = input.isAnonymous;
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("posts")
    .update(updatePayload)
    .eq("id", input.postId)
    .eq("author_user_id", input.authorUserId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to update post: ${error.message}`);
  }

  const reorderPromises = finalImageRows.map((image, index) =>
    supabaseAdmin
      .from("post_images")
      .update({ sort_order: index })
      .eq("id", image.id)
      .eq("post_id", input.postId)
  );
  await Promise.all(reorderPromises);

  if (removedImageRows.length > 0) {
    const removedImageIds = removedImageRows.map((image) => image.id);
    const { error: deleteImageRowsError } = await supabaseAdmin
      .from("post_images")
      .delete()
      .eq("post_id", input.postId)
      .in("id", removedImageIds);

    if (deleteImageRowsError) {
      throw new Error(`Failed to delete removed images: ${deleteImageRowsError.message}`);
    }

    await removePostImageObjects(
      removedImageRows
        .map((image) => image.object_path)
        .filter((value): value is string => Boolean(value))
    );
  }
}

export async function softDeletePostById(postId: string, authorUserId: string) {
  const post = await getEditablePostById(postId);
  if (!post) {
    throw new Error("POST_NOT_FOUND");
  }
  if (post.author_user_id !== authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (post.status === "draft") {
    const draftImages = await listEditablePostImageRows(postId);
    const { error: deleteError } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("author_user_id", authorUserId);

    if (deleteError) {
      throw new Error(`Failed to discard draft: ${deleteError.message}`);
    }

    await removePostImageObjects(
      draftImages
        .map((image) => image.object_path)
        .filter((value): value is string => Boolean(value))
    );
    return;
  }

  const { error } = await supabaseAdmin
    .from("posts")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: authorUserId,
    })
    .eq("id", postId)
    .eq("author_user_id", authorUserId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to delete post: ${error.message}`);
  }
}

export async function togglePostAmen(postId: string, userId: string) {
  const visiblePost = await ensureVisiblePost(postId);
  if (!visiblePost) {
    throw new Error("POST_NOT_FOUND");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: existingAmen, error: existingAmenError } = await supabaseAdmin
    .from("post_amens")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle<AmenStateRow>();

  if (existingAmenError) {
    throw new Error(`Failed to check amen state: ${existingAmenError.message}`);
  }

  let hasAmened = false;
  if (existingAmen) {
    const { error } = await supabaseAdmin
      .from("post_amens")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw new Error(`Failed to remove amen: ${error.message}`);
    hasAmened = false;
  } else {
    const { error } = await supabaseAdmin
      .from("post_amens")
      .insert({ post_id: postId, user_id: userId });
    if (error) throw new Error(`Failed to add amen: ${error.message}`);
    hasAmened = true;
  }

  const { data: postRow, error: postError } = await supabaseAdmin
    .from("posts")
    .select("amen_count")
    .eq("id", postId)
    .maybeSingle<AmenCountRow>();
  if (postError) {
    throw new Error(`Failed to load amen count: ${postError.message}`);
  }
  if (!postRow) {
    throw new Error("Post not found");
  }

  return { amenCount: postRow.amen_count, hasAmened };
}
