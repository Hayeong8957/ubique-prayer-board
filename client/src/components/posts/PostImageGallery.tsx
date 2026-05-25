interface PostImageGalleryProps {
  imageUrls: string[];
}

export function PostImageGallery({ imageUrls }: PostImageGalleryProps) {
  if (imageUrls.length === 0) return null;

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {imageUrls.map((imageUrl, index) => (
        <div
          key={`${imageUrl}-${index}`}
          className="overflow-hidden rounded-2xl border border-surface bg-surface/40 p-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`첨부 이미지 ${index + 1}`}
            className="block max-h-[720px] w-full object-contain"
          />
        </div>
      ))}
    </div>
  );
}
