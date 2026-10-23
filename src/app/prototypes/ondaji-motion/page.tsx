import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OndajiMotionLab } from "@/components/OndajiMotionLab";
import { getMedia, getProjectBySlug } from "@/lib/content";

export const metadata: Metadata = {
  title: "Ondaji Motion Lab",
  robots: { index: false, follow: false },
};

export default async function OndajiMotionPrototype() {
  const [project, media] = await Promise.all([getProjectBySlug("ondaji"), getMedia()]);
  if (!project) notFound();
  const ids = [project.presentation.featuredMediaId, ...project.presentation.mediaIds].filter((id, index, values) => id && values.indexOf(id) === index);
  const items = ids.map((id) => media.find((item) => item.id === id)).filter((item) => item !== undefined).slice(0, 3).map((item) => ({
    id: item.id,
    src: item.poster || item.file,
    alt: item.alt,
    width: item.originalWidth,
    height: item.originalHeight,
  }));
  if (items.length < 2) notFound();
  return <OndajiMotionLab projectName={project.name} items={items} />;
}
