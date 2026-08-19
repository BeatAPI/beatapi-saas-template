
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface UserAvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  name: string;
  image?: string | null;
}

const GOOGLE_BLUE_CLASS = 'bg-[#4285F4]';

export function getUserAvatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'U';
  }

  return Array.from(trimmed)[0] ?? 'U';
}

export function shouldRenderAvatarImage({
  image: _image,
  imageLoadFailed: _imageLoadFailed,
}: {
  image: string | null | undefined;
  imageLoadFailed: boolean;
}) {
  return false;
}

export function UserAvatar({
  name,
  image: _image,
  className,
  ...props
}: UserAvatarProps) {
  return (
    <div
      className={cn(
        'relative flex size-8 shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'flex size-full items-center justify-center text-sm font-medium text-white',
          GOOGLE_BLUE_CLASS
        )}
      >
        <span className="sr-only">{name}</span>
        {getUserAvatarInitial(name)}
      </div>
    </div>
  );
}
