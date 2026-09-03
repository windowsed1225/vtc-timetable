import CourseDetailView from "@/components/CourseDetailView";
import { canonicalCourseCode } from "@/lib/course-route";

// Canonical course-detail route: /courses/<lowercase course code>.
export default async function CoursePage({
	params,
}: {
	params: Promise<{ courseCode: string }>;
}) {
	const { courseCode } = await params;
	return <CourseDetailView courseId={canonicalCourseCode(courseCode)} />;
}
