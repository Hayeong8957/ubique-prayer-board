export type BoardCode = "prayer" | "sermon";

export interface PostListItem {
  id: string;
  title: string;
  content: string;
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
  title: string;
  content: string;
  isAnonymous: boolean;
  isPinned: boolean;
  commentCount: number;
  amenCount: number;
  hasAmened: boolean;
  createdAt: string;
  authorName: string;
}

export interface CommentItem {
  id: string;
  postId: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  authorName: string;
}

export interface CreatePostInput {
  boardCode: BoardCode;
  content: string;
  isAnonymous: boolean;
  authorUserId: string;
  title?: string;
}
