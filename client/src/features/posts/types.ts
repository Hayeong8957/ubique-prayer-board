export type BoardCode = "prayer" | "sermon";
export type PostStatus = "draft" | "published";

export interface PostImageItem {
  id: string;
  publicUrl: string;
  sortOrder: number;
}

export interface PostListItem {
  id: string;
  title: string;
  scriptureText: string | null;
  content: string;
  imageUrls: string[];
  isAnonymous: boolean;
  isPinned: boolean;
  commentCount: number;
  amenCount: number;
  hasAmened: boolean;
  createdAt: string;
  authorName: string;
}

export interface PostDetail {
  id: string;
  boardCode: BoardCode;
  authorUserId: string;
  title: string;
  scriptureText: string | null;
  content: string;
  imageUrls: string[];
  images: PostImageItem[];
  status: PostStatus;
  isAnonymous: boolean;
  isPinned: boolean;
  commentCount: number;
  amenCount: number;
  hasAmened: boolean;
  createdAt: string;
  authorName: string;
}

export interface UpdatePostInput {
  postId: string;
  authorUserId: string;
  title?: string;
  scriptureText?: string | null;
  content: string;
  imageIds?: string[];
  isAnonymous?: boolean;
}

export interface CommentItem {
  id: string;
  postId: string;
  authorUserId: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  authorName: string;
}

export interface CommentPagination {
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextPage: number | null;
}

export interface CreatePostInput {
  boardCode: BoardCode;
  title?: string;
  scriptureText?: string | null;
  content: string;
  isAnonymous: boolean;
  authorUserId: string;
}
