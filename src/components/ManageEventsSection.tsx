"use client";

import { useState } from "react";
import ManageEventsModal from "./ManageEventsModal";

interface CourseOption {
    courseCode: string;
    courseTitle: string;
    semester: string;
}

interface ManageEventsSectionProps {
    courses: CourseOption[];
    onRefresh: () => void;
}

export default function ManageEventsSection({ courses, onRefresh }: ManageEventsSectionProps) {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            <section>
                <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3 px-2">
                    Manage Events
                </h2>
                <button
                    onClick={() => setModalOpen(true)}
                    className="w-full flex items-center gap-2 py-2 px-3 rounded-lg border border-border bg-overlay hover:bg-active transition-colors text-sm text-text-secondary"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-text-tertiary shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    Delete Unattended Events…
                </button>
            </section>

            <ManageEventsModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                courses={courses}
                onRefresh={onRefresh}
            />
        </>
    );
}
