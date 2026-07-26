"use client";

import { deleteEventsByDateRange, previewDeleteEventsByDateRange } from "@/app/actions";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

const SEM_KEY_MAP: Record<string, "sem1Label" | "sem2Label" | "sem3Label"> = {
    "SEM 1": "sem1Label",
    "SEM 2": "sem2Label",
    "SEM 3": "sem3Label",
};

const SEMESTER_ORDER: Record<string, number> = { "SEM 3": 3, "SEM 2": 2, "SEM 1": 1 };

interface CourseOption {
    courseCode: string;
    courseTitle: string;
    semester: string;
}

interface PreviewEvent {
    vtc_id: string;
    startTime: string;
    endTime: string;
}

interface ManageEventsModalProps {
    isOpen: boolean;
    onClose: () => void;
    courses: CourseOption[];
    onRefresh: () => void;
}

export default function ManageEventsModal({ isOpen, onClose, courses, onRefresh }: ManageEventsModalProps) {
    const tCal = useTranslations("calendar");
    const [isClosing, setIsClosing] = useState(false);
    const [selectedSemester, setSelectedSemester] = useState("");
    const [selectedKey, setSelectedKey] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [allEvents, setAllEvents] = useState<PreviewEvent[] | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const uniqueCourses = useMemo(() =>
        courses.reduce<CourseOption[]>((acc, c) => {
            const key = `${c.courseCode}__${c.semester}`;
            if (!acc.find(x => `${x.courseCode}__${x.semester}` === key)) acc.push(c);
            return acc;
        }, []),
        [courses]
    );

    const availableSemesters = useMemo(() => {
        const sems = [...new Set(uniqueCourses.map(c => c.semester || "SEM 2"))];
        return sems.sort((a, b) => (SEMESTER_ORDER[b] ?? 0) - (SEMESTER_ORDER[a] ?? 0));
    }, [uniqueCourses]);

    const coursesForSemester = useMemo(() =>
        selectedSemester ? uniqueCourses.filter(c => c.semester === selectedSemester) : [],
        [uniqueCourses, selectedSemester]
    );

    const selectedCourse = uniqueCourses.find(c => `${c.courseCode}__${c.semester}` === selectedKey);

    // Reset course when semester changes
    useEffect(() => { setSelectedKey(""); }, [selectedSemester]);

    // Auto-fetch all unattended events when course changes
    useEffect(() => {
        if (!selectedCourse) { setAllEvents(null); setSelected(new Set()); setFromDate(""); setToDate(""); return; }
        let cancelled = false;
        setIsLoading(true);
        setAllEvents(null);
        setSelected(new Set());
        setFromDate("");
        setToDate("");

        previewDeleteEventsByDateRange(
            selectedCourse.courseCode,
            selectedCourse.semester,
            new Date("2000-01-01"),
            new Date("2099-12-31"),
        ).then(result => {
            if (cancelled) return;
            setIsLoading(false);
            if (result.success) {
                const events = result.events ?? [];
                setAllEvents(events);
                if (events.length > 0) {
                    setFromDate(events[0].startTime.slice(0, 10));
                    // Select all by default
                    setSelected(new Set(events.map(e => e.vtc_id)));
                }
            }
        });
        return () => { cancelled = true; };
    }, [selectedKey]);

    // Filter displayed events by date range
    const filteredEvents = useMemo(() => {
        if (!allEvents) return [];
        return allEvents.filter(e => {
            const d = e.startTime.slice(0, 10);
            if (fromDate && d < fromDate) return false;
            if (toDate && d > toDate) return false;
            return true;
        });
    }, [allEvents, fromDate, toDate]);

    // When filter changes, auto-select all visible events
    useEffect(() => {
        if (!allEvents) return;
        setSelected(new Set(filteredEvents.map(e => e.vtc_id)));
    }, [filteredEvents]);

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        const allVisible = filteredEvents.map(e => e.vtc_id);
        const allChecked = allVisible.every(id => selected.has(id));
        setSelected(allChecked ? new Set() : new Set(allVisible));
    };

    const handleDelete = async () => {
        if (!selectedCourse || selected.size === 0) return;
        if (!confirm(`Delete ${selected.size} selected event(s)? This cannot be undone.`)) return;
        setIsDeleting(true);

        // Build vtc_id list — use date-range deletion bounded by selection extremes
        const toDelete = (allEvents ?? []).filter(e => selected.has(e.vtc_id));
        const dates = toDelete.map(e => e.startTime.slice(0, 10)).sort();
        const from = new Date(dates[0]);
        const to = new Date(dates[dates.length - 1]);
        to.setHours(23, 59, 59, 999);

        await deleteEventsByDateRange(selectedCourse.courseCode, selectedCourse.semester, from, to);
        setIsDeleting(false);
        handleClose();
        onRefresh();
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => { setIsClosing(false); onClose(); }, 180);
    };

    if (!isOpen) return null;

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString("en-HK", { weekday: "short", month: "short", day: "numeric" });

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString("en-HK", { hour: "2-digit", minute: "2-digit", hour12: false });

    const allVisibleChecked = filteredEvents.length > 0 && filteredEvents.every(e => selected.has(e.vtc_id));
    const someChecked = filteredEvents.some(e => selected.has(e.vtc_id));

    return (
        <div className={`modal-overlay ${isClosing ? "modal-closing" : ""}`} onClick={handleClose}>
            <div
                className={`modal-content max-w-md w-full ${isClosing ? "modal-closing" : ""}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="font-display text-base font-semibold text-[var(--foreground)]">Manage Events</h2>
                        <p className="text-xs text-text-tertiary mt-0.5">Remove unattended scheduled events</p>
                    </div>
                    <button onClick={handleClose} className="btn-icon shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Semester selector */}
                <div className="mb-3">
                    <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1.5">Semester</p>
                    <select
                        value={selectedSemester}
                        onChange={e => setSelectedSemester(e.target.value)}
                        className="w-full px-3 py-2 bg-overlay border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-border-strong"
                    >
                        <option value="">Select a semester…</option>
                        {availableSemesters.map(sem => (
                            <option key={sem} value={sem}>{tCal(SEM_KEY_MAP[sem] ?? "sem1Label")}</option>
                        ))}
                    </select>
                </div>

                {/* Course selector */}
                {selectedSemester && (
                    <div className="mb-4">
                        <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1.5">Course</p>
                        <select
                            value={selectedKey}
                            onChange={e => setSelectedKey(e.target.value)}
                            className="w-full px-3 py-2 bg-overlay border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-border-strong"
                        >
                            <option value="">Select a course…</option>
                            {coursesForSemester.map(c => (
                                <option key={`${c.courseCode}__${c.semester}`} value={`${c.courseCode}__${c.semester}`}>
                                    {c.courseCode} — {c.courseTitle}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center justify-center py-8">
                        <svg className="animate-spin h-5 w-5 text-text-secondary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </div>
                )}

                {/* Results */}
                {!isLoading && allEvents !== null && (
                    allEvents.length === 0 ? (
                        <p className="text-sm text-text-tertiary text-center py-6">No unattended events found.</p>
                    ) : (
                        <>
                            {/* Date range filter */}
                            <div className="flex gap-2 mb-4">
                                <div className="flex-1">
                                    <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">From</p>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={e => setFromDate(e.target.value)}
                                        className="w-full px-2 py-1.5 bg-overlay border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-border-strong"
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">To</p>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={e => setToDate(e.target.value)}
                                        className="w-full px-2 py-1.5 bg-overlay border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-border-strong"
                                    />
                                </div>
                            </div>

                            {/* Select-all row */}
                            <div className="flex items-center justify-between px-1 mb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleChecked}
                                        ref={el => { if (el) el.indeterminate = someChecked && !allVisibleChecked; }}
                                        onChange={toggleAll}
                                        className="w-4 h-4 rounded accent-[var(--error)]"
                                    />
                                    <span className="text-xs text-text-secondary">Select all visible</span>
                                </label>
                                <span className="text-xs text-warning font-medium">
                                    {selected.size} selected / {allEvents.length} total
                                </span>
                            </div>

                            {/* Event list */}
                            <div className="border border-border rounded-xl overflow-hidden mb-4">
                                <div className="max-h-64 overflow-y-auto divide-y divide-border-subtle">
                                    {filteredEvents.length === 0 ? (
                                        <p className="text-xs text-text-tertiary text-center py-4">No events in this date range.</p>
                                    ) : (
                                        filteredEvents.map(e => (
                                            <label
                                                key={e.vtc_id}
                                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${selected.has(e.vtc_id) ? "bg-error/10 hover:bg-error/15" : "hover:bg-overlay"}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(e.vtc_id)}
                                                    onChange={() => toggleOne(e.vtc_id)}
                                                    className="w-4 h-4 rounded accent-[var(--error)] shrink-0"
                                                />
                                                <span className="text-xs text-foreground flex-1">{formatDate(e.startTime)}</span>
                                                <span className="text-[11px] text-text-tertiary">{formatTime(e.startTime)} – {formatTime(e.endTime)}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Delete button */}
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting || selected.size === 0}
                                className="w-full py-2.5 px-4 bg-error hover:opacity-90 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-40"
                            >
                                {isDeleting ? "Deleting…" : selected.size === 0 ? "Select events to delete" : `Delete ${selected.size} Event${selected.size > 1 ? "s" : ""}`}
                            </button>
                        </>
                    )
                )}
            </div>
        </div>
    );
}
