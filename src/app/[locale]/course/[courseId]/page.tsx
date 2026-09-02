import CourseDetailView from "@/components/CourseDetailView";
import { canonicalCourseCode } from "@/lib/course-route";

// Legacy singular path kept so existing /course/<CODE> links stay valid.
// New links are built with courseHref() and point at /courses/<code>.
export default async function CoursePage({
	params,
}: {
	params: Promise<{ courseId: string }>;
}) {
	const { courseId } = await params;
	return <CourseDetailView courseId={canonicalCourseCode(courseId)} />;
}
