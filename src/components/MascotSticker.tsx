import teacherWave from "@/assets/stickers/teacher-wave.png";
import teacherCalendar from "@/assets/stickers/teacher-calendar.png";
import teacherCamera from "@/assets/stickers/teacher-camera.png";
import { cn } from "@/lib/utils";

export type MascotVariant = "wave" | "calendar" | "camera";

export default function MascotSticker({
  variant,
  className,
  alt,
}: {
  variant: MascotVariant;
  className?: string;
  alt?: string;
}) {
  const src =
    variant === "wave" ? teacherWave : variant === "calendar" ? teacherCalendar : teacherCamera;

  const defaultAlt =
    variant === "wave"
      ? "銀髮老師貼圖：揮手"
      : variant === "calendar"
        ? "銀髮老師貼圖：行事曆"
        : "銀髮老師貼圖：相機";

  return (
    <img
      src={src}
      alt={alt ?? defaultAlt}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}
