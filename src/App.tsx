import { useState } from 'react';
import { CalendarCheck, LayoutGrid, Settings as SettingsIcon, Trophy } from 'lucide-react';
import { TodayScreen } from './components/TodayScreen';
import { RoomsScreen } from './components/RoomsScreen';
import { ScoresScreen } from './components/ScoresScreen';
import { Settings } from './components/Settings';
import { SetupSheet } from './components/SetupSheet';
import { TaskSheet } from './components/TaskSheet';
import { useNow, useRooms } from './hooks';
import { useSyncStatus } from './sync';

type Tab = 'today' | 'rooms' | 'scores' | 'settings';

const TABS: { key: Tab; label: string; Icon: typeof CalendarCheck }[] = [
  { key: 'today', label: 'Today', Icon: CalendarCheck },
  { key: 'rooms', label: 'Rooms', Icon: LayoutGrid },
  { key: 'scores', label: 'Scores', Icon: Trophy },
  { key: 'settings', label: 'Settings', Icon: SettingsIcon },
];

type TaskSheetState = { editId?: string; roomId?: string } | null;

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [taskSheet, setTaskSheet] = useState<TaskSheetState>(null);
  const [addingRooms, setAddingRooms] = useState(false);
  const rooms = useRooms();
  const sync = useSyncStatus();

  const firstRun = rooms !== undefined && rooms.length === 0;
  const title = TABS.find((t) => t.key === tab)!.label;
  const now = useNow();
  const dateLabel = new Date(now).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="app">
      <header className="topbar">
        <h1>{tab === 'today' ? 'Today' : title}</h1>
        <div className="date">
          {dateLabel}
          {sync.state === 'syncing' && ' · syncing'}
          {sync.state === 'error' && ' · sync error'}
        </div>
      </header>

      <main className="content">
        {tab === 'today' && <TodayScreen onEditTask={(id) => setTaskSheet({ editId: id })} />}
        {tab === 'rooms' && (
          <RoomsScreen onEditTask={(id) => setTaskSheet({ editId: id })} onAddTask={(roomId) => setTaskSheet({ roomId })} />
        )}
        {tab === 'scores' && <ScoresScreen />}
        {tab === 'settings' && <Settings onAddRooms={() => setAddingRooms(true)} />}
      </main>

      <nav className="nav">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {taskSheet && <TaskSheet {...taskSheet} onClose={() => setTaskSheet(null)} />}
      {firstRun && <SetupSheet firstRun roomCount={0} />}
      {addingRooms && !firstRun && (
        <SetupSheet firstRun={false} roomCount={rooms?.length ?? 0} onClose={() => setAddingRooms(false)} />
      )}
    </div>
  );
}
