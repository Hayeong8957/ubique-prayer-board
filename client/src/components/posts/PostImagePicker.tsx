import { ImagePlus, X } from "lucide-react";
import type { ChangeEvent } from "react";
import type { LocalPostImageDraft } from "@/features/posts/images.client";
import type { PostImageItem } from "@/features/posts/types";

interface PostImagePickerProps {
  existingImages?: PostImageItem[];
  localImages: LocalPostImageDraft[];
  disabled?: boolean;
  maxCount: number;
  onAddFiles: (files: File[]) => void;
  onRemoveExisting?: (imageId: string) => void;
  onRemoveLocal: (id: string) => void;
}

export function PostImagePicker({
  existingImages = [],
  localImages,
  disabled = false,
  maxCount,
  onAddFiles,
  onRemoveExisting,
  onRemoveLocal,
}: PostImagePickerProps) {
  const totalCount = existingImages.length + localImages.length;

  function onChangeFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      onAddFiles(files);
    }
    event.target.value = "";
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-textMain">이미지 첨부</p>
        <p className="text-xs text-textSub">{totalCount}/{maxCount}</p>
      </div>

      <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-surface bg-surface/40 px-4 py-4 text-sm font-medium text-textMain transition hover:bg-surface">
        <ImagePlus className="h-4 w-4" />
        <span>이미지 선택</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={disabled || totalCount >= maxCount}
          className="hidden"
          onChange={onChangeFiles}
        />
      </label>

      {totalCount === 0 ? (
        <p className="text-xs text-textSub">최대 {maxCount}장, 파일당 5MB까지 첨부할 수 있습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {existingImages.map((image, index) => (
            <div
              key={image.id}
              className="relative overflow-hidden rounded-2xl border border-surface bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.publicUrl}
                alt={`첨부 이미지 ${index + 1}`}
                className="block h-32 w-full object-cover"
              />
              {onRemoveExisting ? (
                <button
                  type="button"
                  onClick={() => onRemoveExisting(image.id)}
                  disabled={disabled}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
                  aria-label="기존 이미지 제거"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}

          {localImages.map((image) => (
            <div
              key={image.id}
              className="relative overflow-hidden rounded-2xl border border-surface bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt={image.file.name}
                className="block h-32 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveLocal(image.id)}
                disabled={disabled}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
                aria-label="새 이미지 제거"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
