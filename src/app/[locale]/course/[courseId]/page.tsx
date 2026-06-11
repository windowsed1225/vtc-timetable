import CourseDetailView from "@/components/CourseDetailView";

// Dynamic per-course detail route — /course/[courseId].
export default async function CoursePage({
	params,
}: {
	params: Promise<{ courseId: string }>;
}) {
	const { courseId } = await params;
	return <CourseDetailView courseId={decodeURIComponent(courseId)} />;
}
