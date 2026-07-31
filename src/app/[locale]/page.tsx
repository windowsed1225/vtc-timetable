"use client";

import {
    checkStoredToken,
    finalizeAttendanceSync,
    getHybridAttendanceStats,
    getMoodleDeadlines,
    getStoredEvents,
    getUniqueCourses,
    HybridAttendanceStats,
    listAttendanceCoursesStored,
    prepareVtcSync,
    refreshAttendance,
    shouldAutoSync,
    syncCourseAttendanceStored,
    syncSemesterFromStoredToken,
    syncSemesterTimetableStored,
} from "@/app/actions";
import EventDetailsModal from "@/components/EventDetailsModal";
import LandingPage from "@/components/landing/LandingPage";
import SessionSplash from "@/components/SessionSplash";
import Sidebar from "@/components/Sidebar";
import SignInModal from "@/components/SignInModal";
import SyncModal, { type SyncProgress } from "@/components/SyncModal";
import TutorialSimulation from "@/components/TutorialSimulation";
import TopNavbar from "@/components/TopNavbar";
import TimetableCalendar from "@/components/TimetableCalendar";
import CalendarTopActions from "@/components/CalendarTopActions";
import MobileAttendanceView from "@/components/MobileAttendanceView";
import MobileBottomNav from "@/components/MobileBottomNav";
import UpcomingClasses from "@/components/UpcomingClasses";
import { getDateArray, getSemestersToSync } from "@/lib/utils";
import { CalendarEvent } from "@/types/timetable";
import { createEvents, EventAttributes } from "ics";
import { useSession } from "@/lib/auth-client";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Views } from "react-big-calendar";

const SEMESTER_PROGRESS_LABELS: Record<number, string> = { 1: "Fall (SEM 1)", 2: "Spring (SEM 2)", 3: "Summer (SEM 3)" };

// Per-semester progress shown in the expandable background-sync details panel.
type SemesterSyncStatus = "pending" | "syncing" | "done" | "error";
interface SemesterSyncProgress {
    semester: number;
    label: string;
    status: SemesterSyncStatus;
    newEvents?: number;
}

export default function Home() {
    const t = useTranslations("sync");
    const tc = useTranslations("calendar");
    const tTour = useTranslations("tour");
    const locale = useLocale();

    // Auth state
    const { data: session, isPending } = useSession();
    const status = isPending ? "loading" : session ? "authenticated" : "unauthenticated";

    // Ghost-cursor tutorial demo
    const [showDemo, setShowDemo] = useState(false);

    // Whether a *valid* VTC token is actually stored (verified via checkStoredToken).
    // Drives the Sync modal's Quick Sync / saved-token view. Defaults false so we
    // never show "valid connection" until confirmed.
    const [hasSavedToken, setHasSavedToken] = useState(false);

    // Calendar state
    const [view, setView] = useState<View>(() => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches ? Views.DAY : Views.WORK_WEEK);
    const [date, setDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [semesterFilter, setSemesterFilter] = useState<string>("all");
    const [mobileTab, setMobileTab] = useState<"calendar" | "attendance">("calendar");

    // Data state
    const [courses, setCourses] = useState<
        Array<{ courseCode: string; courseTitle: string; colorIndex: number; semester: string; status: string }>
    >([]);
    const [attendance, setAttendance] = useState<HybridAttendanceStats[]>([]);

    // UI state
    const [vtcUrl, setVtcUrl] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [isRefreshingAttendance, setIsRefreshingAttendance] = useState(false);
    const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showSignInModal, setShowSignInModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [notification, setNotification] = useState<{
        type: "success" | "error" | "loading";
        message: string;
    } | null>(null);
    const [showTokenExpiredWarning, setShowTokenExpiredWarning] = useState(false);
    // Live per-semester progress for the background sync, surfaced in an expandable
    // panel attached to the loading pill.
    const [syncProgress, setSyncProgress] = useState<SemesterSyncProgress[] | null>(null);
    const [syncDetailsExpanded, setSyncDetailsExpanded] = useState(false);

    // Load stored events on mount
    useEffect(() => {
        loadStoredData();
    }, []);

    // Load stored events from localStorage URL
    useEffect(() => {
        const savedUrl = localStorage.getItem("vtc_url");
        if (savedUrl) {
            setVtcUrl(savedUrl);
        }
    }, []);

    const loadStoredData = async () => {
        try {
            const [eventsResult, coursesResult, moodleResult, attendanceResult] = await Promise.all([
                getStoredEvents(),
                getUniqueCourses(),
                getMoodleDeadlines(),
                getHybridAttendanceStats(),
            ]);

            const classEvents = eventsResult.success ? (eventsResult.data ?? []) : [];
            const deadlineEvents = moodleResult.success ? (moodleResult.data ?? []) : [];
            setEvents([...classEvents, ...deadlineEvents]);

            if (coursesResult.success && coursesResult.data) {
                setCourses(coursesResult.data);
            }

            if (attendanceResult.success && attendanceResult.data) {
                setAttendance(attendanceResult.data);
            }
        } catch (error) {
            console.error("Failed to load stored data:", error);
        }
    };

    const fetchAttendance = async () => {
        try {
            const result = await getHybridAttendanceStats();
            if (result.success && result.data) {
                setAttendance(result.data);
            }
        } catch (error) {
            console.error("Failed to fetch attendance:", error);
        }
    };

    // Check token validity on login
    useEffect(() => {
        if (status !== "authenticated") {
            setHasSavedToken(false);
            return;
        }
        checkStoredToken().then((result) => {
            // Only treat the token as "saved" when it actually exists and is valid.
            setHasSavedToken(result.valid);
            if (!result.valid && result.reason === "expired") {
                setShowTokenExpiredWarning(true);
            }
        });
    }, [status]);

    // Auto-sync on login with 15-minute throttling
    // New users (no events yet) get a full sync of all 3 semesters
    // Existing users get a smart sync of current/upcoming semesters only
    useEffect(() => {
        const performAutoSync = async () => {
            if (status !== "authenticated") {
                return;
            }

            try {
                const syncCheck = await shouldAutoSync();

                if (!syncCheck.should) {
                    console.log(`Auto-sync skipped. Last sync: ${syncCheck.minutesSinceLastSync} minutes ago`);
                    return;
                }

                // Detect new user: if they've never synced, fetch all semesters
                const isNewUser = !syncCheck.lastSync;

                // New users import the full year; existing users only sync the
                // current/upcoming semesters. We sync one semester at a time so the
                // details panel can report live per-semester progress.
                const semesters = isNewUser ? [1, 2, 3] : getSemestersToSync();

                setSyncProgress(
                    semesters.map((s) => ({
                        semester: s,
                        label: SEMESTER_PROGRESS_LABELS[s],
                        status: "pending" as SemesterSyncStatus,
                    })),
                );
                // First-time setup imports the whole year — auto-expand the details
                // panel so new users can watch each semester being fetched.
                setSyncDetailsExpanded(isNewUser);
                setNotification({
                    type: "loading",
                    message: isNewUser ? t("firstTimeSync") : t("backgroundUpdating"),
                });

                let anySuccess = false;

                for (const semesterNum of semesters) {
                    setSyncProgress((prev) =>
                        prev?.map((p) => (p.semester === semesterNum ? { ...p, status: "syncing" } : p)) ?? prev,
                    );

                    const result = await syncSemesterFromStoredToken(semesterNum);

                    if (result.success) {
                        anySuccess = true;
                        setSyncProgress((prev) =>
                            prev?.map((p) =>
                                p.semester === semesterNum
                                    ? { ...p, status: "done", newEvents: result.newEvents ?? 0 }
                                    : p,
                            ) ?? prev,
                        );
                    } else {
                        console.warn(`Background sync failed for semester ${semesterNum}:`, result.error);
                        setSyncProgress((prev) =>
                            prev?.map((p) => (p.semester === semesterNum ? { ...p, status: "error" } : p)) ?? prev,
                        );
                    }
                }

                if (anySuccess) {
                    await loadStoredData();
                    await fetchAttendance();

                    setNotification({
                        type: "success",
                        message: t("updatedAutomatically"),
                    });
                    setTimeout(() => {
                        setNotification(null);
                        setSyncProgress(null);
                        setSyncDetailsExpanded(false);
                    }, 3000);
                } else {
                    setNotification(null);
                    setSyncProgress(null);
                }
            } catch (error) {
                setNotification(null);
                console.error("Auto-sync error:", error);
            }
        };

        performAutoSync();
    }, [status]);


    // Handle refresh attendance from VTC API
    const handleRefreshAttendance = async () => {
        setIsRefreshingAttendance(true);
        try {
            const result = await refreshAttendance();
            if (result.success) {
                await fetchAttendance();
                setNotification({
                    type: "success",
                    message: t("refreshedAttendance", { count: result.updatedCount || 0 }),
                });
                setTimeout(() => setNotification(null), 3000);
            } else {
                setNotification({
                    type: "error",
                    message: result.error || t("failedRefreshAttendance"),
                });
                setTimeout(() => setNotification(null), 5000);
            }
        } catch (error) {
            setNotification({
                type: "error",
                message: error instanceof Error ? error.message : t("failedRefreshAttendance"),
            });
            setTimeout(() => setNotification(null), 5000);
        } finally {
            setIsRefreshingAttendance(false);
        }
    };

    // Handle refresh calendar — forced full sync from VTC API (all 3 semesters)
    // This is the "Refresh" button next to MY CALENDARS in the sidebar
    const handleRefreshCalendar = async () => {
        setIsRefreshingCalendar(true);
        try {
            let totalNewEvents = 0;
            let firstError: string | undefined;

            const semestersToSync = getSemestersToSync();
            for (const semesterNum of semestersToSync) {
                setNotification({ type: "loading", message: `Updating ${SEMESTER_PROGRESS_LABELS[semesterNum]}… (${semestersToSync.indexOf(semesterNum) + 1}/${semestersToSync.length})` });
                const result = await syncSemesterFromStoredToken(semesterNum);
                if (!result.success) {
                    firstError = result.error;
                    break;
                }
                totalNewEvents += result.newEvents ?? 0;
            }

            if (firstError) {
                setNotification({ type: "error", message: firstError || t("failedAutoSync") });
                setTimeout(() => {
                    setNotification(null);
                    setShowSyncModal(true);
                }, 3000);
            } else {
                await loadStoredData();
                await fetchAttendance();
                setNotification({ type: "success", message: t("autoSyncedEvents", { count: totalNewEvents }) });
                setTimeout(() => setNotification(null), 3000);
            }
        } catch (error) {
            setNotification({ type: "error", message: t("failedRefresh") });
            setTimeout(() => setNotification(null), 3000);
        } finally {
            setIsRefreshingCalendar(false);
        }
    };

    // Manual sync via URL — staged full sync (all 3 semesters) that reports
    // real-time, course-level progress into the SyncModal's progress view.
    // Phase weighting: prepare 0–5%, timetables 5–45%, attendance 45–95%, finalize 95–100%.
    // `url === null` → Quick Sync using the token already stored on the account.
    const runStagedSync = async (
        url: string | null,
        onProgress: (p: SyncProgress) => void,
        signal: AbortSignal,
    ) => {
        setIsSyncing(true);

        try {
            // Step 1: validate + persist the token (only when a fresh URL was given)
            onProgress({ percent: 3, phase: "preparing" });
            if (url) {
                const prep = await prepareVtcSync(url);
                if (!prep.success) throw new Error(prep.error || "Failed to validate token");
            }
            if (signal.aborted) return;

            // Step 2: per-semester timetables
            const semesters = [1, 2, 3];
            let totalNewEvents = 0;
            for (let i = 0; i < semesters.length; i++) {
                if (signal.aborted) return;
                onProgress({
                    percent: 5 + (i / semesters.length) * 40,
                    phase: "timetable",
                    semesterLabel: SEMESTER_PROGRESS_LABELS[semesters[i]],
                });
                const result = await syncSemesterTimetableStored(semesters[i]);
                if (!result.success) throw new Error(result.error || "Failed to sync timetable");
                totalNewEvents += result.newEvents || 0;
            }

            // Step 3: course list for attendance
            if (signal.aborted) return;
            onProgress({ percent: 45, phase: "attendance", coursesDone: 0, coursesTotal: 0 });
            const list = await listAttendanceCoursesStored();
            if (!list.success) throw new Error(list.error || "Failed to list courses");
            const courses = list.courses ?? [];

            // Step 4: per-course attendance (real "i / total" + current course id)
            const courseSemesterMap: Record<string, "SEM 1" | "SEM 2" | "SEM 3"> = {};
            let totalNewAttendance = 0;
            for (let i = 0; i < courses.length; i++) {
                if (signal.aborted) return;
                onProgress({
                    percent: 45 + (courses.length ? (i / courses.length) * 50 : 50),
                    phase: "attendance",
                    coursesDone: i,
                    coursesTotal: courses.length,
                    currentCourseCode: courses[i].courseCode,
                    currentCourseName: courses[i].courseName,
                });
                const result = await syncCourseAttendanceStored(courses[i].courseCode, courses[i].courseName);
                if (result.success && result.courseSemester) {
                    courseSemesterMap[courses[i].courseCode] = result.courseSemester;
                }
                totalNewAttendance += result.newAttendance || 0;
            }

            // Step 5: finalize (stale cleanup + revalidate)
            if (signal.aborted) return;
            onProgress({
                percent: 96,
                phase: "finalizing",
                coursesDone: courses.length,
                coursesTotal: courses.length,
            });
            await finalizeAttendanceSync(courseSemesterMap);
            onProgress({
                percent: 100,
                phase: "finalizing",
                coursesDone: courses.length,
                coursesTotal: courses.length,
            });

            if (signal.aborted) return;
            if (url) {
                setVtcUrl(url);
                localStorage.setItem("vtc_url", url);
            }
            // A successful sync means a valid token is now stored.
            setHasSavedToken(true);

            await loadStoredData();
            await fetchAttendance();
            // Success is confirmed by the modal's SyncSuccess view — no toast needed here.
        } catch (error) {
            // Surfaced inline by the modal; rethrow so it can display the message.
            throw error;
        } finally {
            setIsSyncing(false);
        }
    };

    // Manual sync (fresh URL) and Quick Sync (stored token) entry points for the modal.
    const handleSync = (url: string, onProgress: (p: SyncProgress) => void, signal: AbortSignal) =>
        runStagedSync(url, onProgress, signal);
    const handleQuickSync = (onProgress: (p: SyncProgress) => void, signal: AbortSignal) =>
        runStagedSync(null, onProgress, signal);

    // Handle ICS export
    const handleExport = useCallback(() => {
        if (events.length === 0) {
            setNotification({
                type: "error",
                message: t("noEventsExport"),
            });
            setTimeout(() => setNotification(null), 3000);
            return;
        }

        const icsEvents: EventAttributes[] = events.map((event) => ({
            title: `${event.resource?.courseTitle || event.title} (${event.resource?.courseCode || ""})`,
            start: getDateArray(Math.floor(event.start.getTime() / 1000)),
            end: getDateArray(Math.floor(event.end.getTime() / 1000)),
            location: event.resource?.location || undefined,
            description: event.resource?.lecturer
                ? `Lecturer: ${event.resource.lecturer}\nType: ${event.resource.lessonType || ""}`
                : undefined,
        }));

        createEvents(icsEvents, (error, value) => {
            if (error) {
                console.error("Error creating ICS file:", error);
                setNotification({
                    type: "error",
                    message: t("failedICS"),
                });
                setTimeout(() => setNotification(null), 3000);
                return;
            }

            const blob = new Blob([value], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "vtc-schedule.ics";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setNotification({
                type: "success",
                message: t("exportSuccess"),
            });
            setTimeout(() => setNotification(null), 3000);
        });
    }, [events]);

    // Mobile sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const filteredEvents = useMemo(
        () => semesterFilter === "all" ? events : events.filter((event) => event.resource?.semester === semesterFilter),
        [events, semesterFilter],
    );
    const handleSemesterFilterChange = (semester: string) => {
        setSemesterFilter(semester);
        const now = new Date();
        if (semester === "SEM 1") {
            const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
            setDate(new Date(year, 8, 1));
        } else if (semester === "SEM 2") {
            setDate(new Date(now.getFullYear(), 0, 1));
        } else if (semester === "SEM 3") {
            setDate(new Date(now.getFullYear(), 4, 1));
        }
    };

    // Session gate: splash while the session resolves (isPending is true on both the
    // server render and the first client render, so there is no hydration flash),
    // landing page for visitors, calendar app for signed-in users.
    if (isPending) return <SessionSplash />;
    if (!session) return <LandingPage />;

    return (
        <div className="dashboard-shell h-screen flex flex-col bg-[var(--background)] overflow-hidden">
            {/* Top Navbar */}
            <TopNavbar
                onSignIn={() => setShowSignInModal(true)}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
                sidebarOpen={sidebarOpen}
                actions={courses.length > 0 ? <CalendarTopActions courses={courses} onRefresh={handleRefreshCalendar} /> : undefined}
            />

            {/* Body: Sidebar + Main */}
            <div className="flex-1 flex overflow-hidden">
            {/* Mobile overlay */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`}
                onClick={() => setSidebarOpen(false)}
            />
            {/* Sidebar */}
            <Sidebar
                courses={courses}
                events={events}
                attendance={attendance}
                onSyncClick={() => { if (session) { setShowSyncModal(true); } else { setShowSignInModal(true); } setSidebarOpen(false); }}
                onRefreshAttendance={handleRefreshAttendance}
                onRefreshCalendar={handleRefreshCalendar}
                isSyncing={isSyncing}
                isRefreshingAttendance={isRefreshingAttendance}
                isRefreshingCalendar={isRefreshingCalendar}
                vtcUrl={vtcUrl}
                user={session?.user}
                sidebarOpen={sidebarOpen}
                onStartTour={() => { setSidebarOpen(false); setShowDemo(true); }}
            />

            {/* Main Content */}
            <main data-tour="calendar" className={`dashboard-main flex-1 flex flex-col overflow-hidden relative mobile-tab-${mobileTab}`}>
                <div className="calendar-workspace-content">
                {/* Token Expired Warning Banner */}
                {showTokenExpiredWarning && (
                    <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/15 border border-warning/30 text-warning animate-slideIn">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <p className="flex-1 text-sm font-medium">
                            {t("tokenExpiredTitle")}
                        </p>
                        <button
                            onClick={() => { setShowSyncModal(true); setShowTokenExpiredWarning(false); }}
                            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-warning text-white hover:opacity-90 transition-all"
                        >
                            {t("reSync")}
                        </button>
                        <button
                            onClick={() => setShowTokenExpiredWarning(false)}
                            className="shrink-0 btn-icon"
                            aria-label="Dismiss warning"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
                {events.length > 0 ? (
                    <>
                        <UpcomingClasses events={filteredEvents} onSelect={setSelectedEvent} />
                        <TimetableCalendar
                            events={filteredEvents}
                            view={view}
                            date={date}
                            semesterFilter={semesterFilter}
                            onSemesterFilterChange={handleSemesterFilterChange}
                            onViewChange={setView}
                            onNavigate={setDate}
                            onSelectEvent={(event) => setSelectedEvent(event)}
                            locale={locale}
                        />
                    </>
                ) : (
                    /* ── Authenticated, no data yet ── */
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="text-center max-w-md animate-fadeIn">
                            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[var(--calendar-header-bg)] flex items-center justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1}
                                    stroke="currentColor"
                                    className="w-12 h-12 text-[var(--text-tertiary)]"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                                    />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-semibold mb-2">{tc("noScheduleYet")}</h2>
                            <p className="text-[var(--text-secondary)] mb-6">
                                {tc("noScheduleSubtitle")}
                            </p>
                            <button
                                onClick={() => setShowSyncModal(true)}
                                className="btn-primary inline-flex items-center gap-2"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-5 h-5"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                                    />
                                </svg>
                                {tc("syncSchedule")}
                            </button>
                            <div className="mt-3">
                                <button
                                    onClick={() => setShowDemo(true)}
                                    className="text-sm text-[var(--text-tertiary)] hover:text-[var(--foreground)] transition-colors"
                                >
                                    {tTour("seeHowItWorks")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                </div>

                <MobileAttendanceView attendance={attendance} onRefresh={handleRefreshAttendance} isRefreshing={isRefreshingAttendance} />

                {/* Notification Toast */}
                {notification && (
                    notification.type === "loading" ? (
                        /* ── Vercel-style dark sync pill ── */
                        <div className="absolute bottom-6 right-6 z-50 animate-toast-enter flex flex-col items-end gap-2">
                            {/* Expandable details panel */}
                            {syncProgress && syncProgress.length > 0 && syncDetailsExpanded && (
                                <div className="w-[260px] bg-surface border border-border rounded-xl shadow-2xl p-2 animate-toast-enter">
                                    {syncProgress.map((p) => (
                                        <div key={p.semester} className="flex items-center gap-2.5 px-2 py-1.5 text-sm">
                                            {/* Status icon */}
                                            {p.status === "done" ? (
                                                <svg className="w-3.5 h-3.5 text-success shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                                            ) : p.status === "error" ? (
                                                <svg className="w-3.5 h-3.5 text-error shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                                            ) : p.status === "syncing" ? (
                                                <svg className="w-3.5 h-3.5 text-text-tertiary animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                            ) : (
                                                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-border-strong" /></span>
                                            )}
                                            <span className="flex-1 text-text-secondary tracking-tight truncate">{p.label}</span>
                                            <span className="text-xs text-text-tertiary shrink-0">
                                                {p.status === "done"
                                                    ? t("detailEvents", { count: p.newEvents ?? 0 })
                                                    : p.status === "syncing"
                                                        ? t("statusSyncing")
                                                        : p.status === "error"
                                                            ? t("statusError")
                                                            : t("statusPending")}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="relative flex items-center gap-3 px-5 py-3 bg-surface border border-border rounded-full shadow-2xl overflow-hidden min-w-[240px]">
                                {/* Animated Spinner */}
                                <svg className="w-4 h-4 text-text-tertiary animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                {/* Status Text */}
                                <span className="text-sm font-medium text-text-secondary tracking-tight">
                                    {notification.message}
                                </span>
                                {/* Details toggle */}
                                {syncProgress && syncProgress.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSyncDetailsExpanded((v) => !v)}
                                        aria-expanded={syncDetailsExpanded}
                                        aria-label={syncDetailsExpanded ? t("detailsHide") : t("detailsShow")}
                                        className="ml-auto -mr-1.5 shrink-0 rounded-full p-1 text-text-secondary hover:bg-overlay hover:text-foreground transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3.5 h-3.5 transition-transform ${syncDetailsExpanded ? "rotate-180" : ""}`}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                                        </svg>
                                    </button>
                                )}
                                {/* Indeterminate Bottom Loading Bar */}
                                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-overlay">
                                    <div className="h-full w-1/4 rounded-full bg-accent toast-loading-bar" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── Success / Error toast ── */
                        <div
                            className={`absolute bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg animate-toast-enter ${
                                notification.type === "success"
                                    ? "bg-surface border border-border text-success"
                                    : "bg-surface border border-border text-error"
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                {notification.type === "success" ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                                    </svg>
                                )}
                                <span className="text-sm font-medium text-foreground">{notification.message}</span>
                            </div>
                        </div>
                    )
                )}
            </main>

            <MobileBottomNav
                active={mobileTab}
                onCalendar={() => setMobileTab("calendar")}
                onAttendance={() => setMobileTab("attendance")}
                onMore={() => setSidebarOpen(true)}
            />

            {/* Sync Modal */}
            <SyncModal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                onSync={handleSync}
                onQuickSync={handleQuickSync}
                hasSavedToken={hasSavedToken}
                initialUrl={vtcUrl}
            />

            {/* Ghost-cursor tutorial demo */}
            <TutorialSimulation open={showDemo} onClose={() => setShowDemo(false)} />

            {/* Event Details Modal */}
            <EventDetailsModal
                event={selectedEvent}
                isOpen={selectedEvent !== null}
                onClose={() => setSelectedEvent(null)}
                onRefresh={() => {
                    loadStoredData();
                    fetchAttendance();
                }}
            />

            {/* Sign In Modal */}
            <SignInModal
                isOpen={showSignInModal}
                onClose={() => setShowSignInModal(false)}
            />
            </div>
        </div>
    );
}
