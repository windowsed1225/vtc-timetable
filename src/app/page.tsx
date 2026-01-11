"use client";

import { useState, useCallback, useEffect } from "react";
import { View, Views } from "react-big-calendar";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  syncVtcData,
  getStoredEvents,
  getUniqueCourses,
  getStoredAttendance,
  refreshAttendance,
  AttendanceStats,
} from "./actions";
import { CalendarEvent } from "@/types/timetable";
import { getDateArray } from "@/lib/utils";
import { createEvents, EventAttributes } from "ics";
import TimetableCalendar from "@/components/TimetableCalendar";
import Sidebar from "@/components/Sidebar";
import SyncModal from "@/components/SyncModal";
import EventDetailsModal from "@/components/EventDetailsModal";

export default function Home() {
  // Auth state
  const { data: session, status } = useSession();

  // Calendar state
  const [view, setView] = useState<View>(Views.WORK_WEEK);
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [semesterFilter, setSemesterFilter] = useState<string>("all"); // "all", "SEM 1", "SEM 2", "SEM 3"

  // Data state
  const [courses, setCourses] = useState<
    Array<{ courseCode: string; courseTitle: string; colorIndex: number; semester: string; status: string }>
  >([]);
  const [attendance, setAttendance] = useState<AttendanceStats[]>([]);

  // UI state
  const [vtcUrl, setVtcUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshingAttendance, setIsRefreshingAttendance] = useState(false);
  const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
      const [eventsResult, coursesResult] = await Promise.all([
        getStoredEvents(),
        getUniqueCourses(),
      ]);

      if (eventsResult.success && eventsResult.data) {
        setEvents(eventsResult.data);
        // Keep calendar on current month (don't navigate to first event)
      }

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
      const result = await getStoredAttendance();
      if (result.success && result.data) {
        setAttendance(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
    }
  };

  // Handle refresh attendance from VTC API
  const handleRefreshAttendance = async () => {
    setIsRefreshingAttendance(true);
    try {
      const result = await refreshAttendance();
      if (result.success) {
        await fetchAttendance(); // Reload from database
        setNotification({
          type: "success",
          message: `Refreshed ${result.updatedCount || 0} attendance records`,
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({
          type: "error",
          message: result.error || "Failed to refresh attendance",
        });
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (error) {
      setNotification({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to refresh",
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsRefreshingAttendance(false);
    }
  };

  // Handle refresh calendar from database
  const handleRefreshCalendar = async () => {
    setIsRefreshingCalendar(true);
    try {
      await loadStoredData();
      setNotification({
        type: "success",
        message: "Calendar refreshed",
      });
      setTimeout(() => setNotification(null), 2000);
    } catch (error) {
      setNotification({
        type: "error",
        message: "Failed to refresh calendar",
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsRefreshingCalendar(false);
    }
  };
  const handleSync = async (url: string, semester: number) => {
    setIsSyncing(true);

    try {
      const result = await syncVtcData(url, semester);

      if (!result.success) {
        throw new Error(result.error || "Failed to sync");
      }

      // Save URL for reference
      setVtcUrl(url);
      localStorage.setItem("vtc_url", url);

      // Reload data
      await loadStoredData();
      await fetchAttendance();

      setNotification({
        type: "success",
        message: `Synced ${result.newEvents || 0} events and ${result.newAttendance || 0} attendance records`,
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
        message: "No events to export",
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
          message: "Failed to generate ICS file",
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
        message: "Calendar exported successfully!",
      });
      setTimeout(() => setNotification(null), 3000);
    });
  }, [events]);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex bg-[var(--background)] overflow-hidden">
      {/* Mobile menu button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      {/* Sidebar */}
      <Sidebar
        courses={courses}
        attendance={attendance}
        onSyncClick={() => { setShowSyncModal(true); setSidebarOpen(false); }}
        onExportClick={() => { handleExport(); setSidebarOpen(false); }}
        onSignIn={() => signIn("discord")}
        onSignOut={() => signOut()}
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
        {events.length > 0 ? (
          <>
            {/* Semester Filter */}
            <div className="flex items-center justify-end gap-3 mb-4">
              <label className="text-sm text-[var(--text-secondary)]">Semester:</label>
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[var(--calendar-header-bg)] border border-[var(--calendar-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--calendar-today)]"
              >
                <option value="all">All Semesters</option>
                <option value="SEM 1">Fall (SEM 1)</option>
                <option value="SEM 2">Spring (SEM 2)</option>
                <option value="SEM 3">Summer (SEM 3)</option>
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
              <h2 className="text-2xl font-semibold mb-2">No Schedule Yet</h2>
              <p className="text-[var(--text-secondary)] mb-6">
                Sync your VTC timetable to see your classes here
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
                Sync Schedule
              </button>
            </div>
          </div>
        )}

        {/* Notification Toast */}
        {notification && (
          <div
            className={`absolute bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg animate-slideIn ${notification.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
              }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
          </div>
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
      />
    </div>
  );
}
