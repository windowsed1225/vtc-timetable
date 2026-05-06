"use client";

import {
    autoSyncFromStoredToken,
    checkStoredToken,
    getHybridAttendanceStats,
    getMoodleDeadlines,
    getStoredEvents,
    getUniqueCourses,
    HybridAttendanceStats,
    refreshAttendance,
    shouldAutoSync,
    syncSemesterFromStoredToken,
    syncVtcData,
} from "@/app/actions";
import EventDetailsModal from "@/components/EventDetailsModal";
import Sidebar from "@/components/Sidebar";
import SignInModal from "@/components/SignInModal";
import SyncModal from "@/components/SyncModal";
import TopNavbar from "@/components/TopNavbar";
import TimetableCalendar from "@/components/TimetableCalendar";
import { getDateArray } from "@/lib/utils";
import { CalendarEvent } from "@/types/timetable";
import { createEvents, EventAttributes } from "ics";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { View, Views } from "react-big-calendar";

const SEMESTER_PROGRESS_LABELS: Record<number, string> = { 1: "Fall (SEM 1)", 2: "Spring (SEM 2)", 3: "Summer (SEM 3)" };

export default function Home() {
    const t = useTranslations("sync");
    const tc = useTranslations("calendar");
    const locale = useLocale();

    // Auth state
    const { data: session, status } = useSession();

    // Calendar state
    const [view, setView] = useState<View>(Views.WORK_WEEK);
    const [date, setDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [semesterFilter, setSemesterFilter] = useState<string>("all");

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
            const [eventsResult, coursesResult, moodleResult] = await Promise.all([
                getStoredEvents(),
                getUniqueCourses(),
                getMoodleDeadlines(),
            ]);

            const classEvents = eventsResult.success ? (eventsResult.data ?? []) : [];
            const deadlineEvents = moodleResult.success ? (moodleResult.data ?? []) : [];
            setEvents([...classEvents, ...deadlineEvents]);

            if (coursesResult.success && coursesResult.data) {
                setCourses(coursesResult.data);
            }
        } catch (error) {
            console.error("Failed to load stored data:", error);
        }
    };

    // Fetch attendance from stored data
    useEffect(() => {
        fetchAttendance();
    }, []);

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
        if (status !== "authenticated") return;
        checkStoredToken().then((result) => {
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

                setNotification({
                    type: "loading",
                    message: isNewUser ? t("firstTimeSync") : t("backgroundUpdating"),
                });

                const result = await autoSyncFromStoredToken(
                    isNewUser ? { fetchAll: true } : undefined
                );

                if (result.success) {
                    await loadStoredData();
                    await fetchAttendance();

                    setNotification({
                        type: "success",
                        message: t("updatedAutomatically"),
                    });
                    setTimeout(() => setNotification(null), 3000);
                } else {
                    setNotification(null);
                    console.warn("Background sync failed:", result.error);
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

            for (const semesterNum of [1, 2, 3]) {
                setNotification({ type: "loading", message: `Updating ${SEMESTER_PROGRESS_LABELS[semesterNum]}… (${semesterNum}/3)` });
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

    // Manual sync via URL — always full sync (all 3 semesters)
    // This is the SyncModal flow where a user pastes their VTC URL
    const handleSync = async (url: string) => {
        setIsSyncing(true);

        try {
            // Full sync: iterate all 3 semesters to capture the complete academic year
            let totalNewEvents = 0;
            let totalNewAttendance = 0;

            for (const semesterNum of [1, 2, 3]) {
                setNotification({ type: "loading", message: `Syncing ${SEMESTER_PROGRESS_LABELS[semesterNum]}… (${semesterNum}/3)` });
                const result = await syncVtcData(url, semesterNum);

                if (!result.success) {
                    throw new Error(result.error || "Failed to sync");
                }

                totalNewEvents += result.newEvents || 0;
                totalNewAttendance += result.newAttendance || 0;
            }

            setVtcUrl(url);
            localStorage.setItem("vtc_url", url);

            await loadStoredData();
            await fetchAttendance();

            setNotification({
                type: "success",
                message: t("syncedEvents", { count: totalNewEvents, attendance: totalNewAttendance }),
            });

            setTimeout(() => setNotification(null), 3000);
        } catch (error) {
            setNotification({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to sync",
            });
            setTimeout(() => setNotification(null), 5000);
            throw error;
        } finally {
            setIsSyncing(false);
        }
    };

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

    return (
        <div className="h-screen flex flex-col bg-[var(--background)] overflow-hidden">
            {/* Top Navbar */}
            <TopNavbar
                onSignIn={() => setShowSignInModal(true)}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
                sidebarOpen={sidebarOpen}
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
                onSyncClick={() => { setShowSyncModal(true); setSidebarOpen(false); }}
                onRefreshAttendance={handleRefreshAttendance}
                onRefreshCalendar={handleRefreshCalendar}
                isSyncing={isSyncing}
                isRefreshingAttendance={isRefreshingAttendance}
                isRefreshingCalendar={isRefreshingCalendar}
                vtcUrl={vtcUrl}
                user={session?.user}
                sidebarOpen={sidebarOpen}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col p-6 overflow-hidden relative">
                {/* Token Expired Warning Banner */}
                {showTokenExpiredWarning && (
                    <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 animate-slideIn">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <p className="flex-1 text-sm font-medium">
                            {t("tokenExpiredTitle")}
                        </p>
                        <button
                            onClick={() => { setShowSyncModal(true); setShowTokenExpiredWarning(false); }}
                            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
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
                        {/* Semester Filter */}
                        <div className="flex items-center justify-end gap-3 mb-4">
                            <label className="text-sm text-[var(--text-secondary)]">{tc("semester")}:</label>
                            <select
                                value={semesterFilter}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSemesterFilter(val);
                                    const now = new Date();
                                    if (val === "SEM 1") {
                                        const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
                                        setDate(new Date(year, 8, 1));
                                    } else if (val === "SEM 2") {
                                        setDate(new Date(now.getFullYear(), 0, 1));
                                    } else if (val === "SEM 3") {
                                        setDate(new Date(now.getFullYear(), 4, 1));
                                    }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[var(--calendar-header-bg)] border border-[var(--calendar-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--calendar-today)]"
                            >
                                <option value="all">{tc("allSemesters")}</option>
                                <option value="SEM 1">{tc("fall")}</option>
                                <option value="SEM 2">{tc("spring")}</option>
                                <option value="SEM 3">{tc("summer")}</option>
                            </select>
                        </div>
                        <TimetableCalendar
                            events={semesterFilter === "all"
                                ? events
                                : events.filter(e => e.resource?.semester === semesterFilter)
                            }
                            view={view}
                            date={date}
                            onViewChange={setView}
                            onNavigate={setDate}
                            onSelectEvent={(event) => setSelectedEvent(event)}
                            locale={locale}
                        />
                    </>
                ) : (
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
                        </div>
                    </div>
                )}

                {/* Notification Toast */}
                {notification && (
                    notification.type === "loading" ? (
                        /* ── Vercel-style dark sync pill ── */
                        <div className="absolute bottom-6 right-6 z-50 animate-toast-enter">
                            <div className="relative flex items-center gap-3 px-5 py-3 bg-[#0a0a0a] border border-[#222] rounded-full shadow-2xl overflow-hidden min-w-[240px]">
                                {/* Animated Spinner */}
                                <svg className="w-4 h-4 text-[#666] animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                {/* Status Text */}
                                <span className="text-sm font-medium text-[#d4d4d4] tracking-tight">
                                    {notification.message}
                                </span>
                                {/* Indeterminate Bottom Loading Bar */}
                                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#222]">
                                    <div className="h-full w-1/4 rounded-full bg-white/60 toast-loading-bar" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── Success / Error toast ── */
                        <div
                            className={`absolute bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg animate-toast-enter ${
                                notification.type === "success"
                                    ? "bg-[#0a0a0a] border border-[#222] text-[#3ecf8e]"
                                    : "bg-[#0a0a0a] border border-[#222] text-[#f55353]"
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
                                <span className="text-sm font-medium text-[#ededed]">{notification.message}</span>
                            </div>
                        </div>
                    )
                )}
            </main>

            {/* Sync Modal */}
            <SyncModal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                onSync={handleSync}
                initialUrl={vtcUrl}
            />

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
