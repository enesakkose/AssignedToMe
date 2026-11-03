import { cn } from "@/lib/utils";
import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import { cssInterop } from "nativewind";

const StyledImage = cssInterop(ExpoImage, { className: "style" });

type ImageProps = ExpoImageProps & {
  className?: string;
};

function Image({ className, ...props }: ImageProps) {
  return <StyledImage className={cn("h-full w-full", className)} {...props} />;
}

Image.displayName = "Image";

export { Image, type ImageProps };
