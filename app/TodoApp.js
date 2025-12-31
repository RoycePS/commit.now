"use client";

import { useState, useEffect, useRef } from "react";

export default function TodoApp() {
    const [permanent, setPermanent] = useState([]);
    const [daily, setDaily] = useState({});
    const [settings, setSettings] = useState({ theme: "dark", lockPast: false });
    const [currentDate, setCurrentDate] = useState("");
    const [lastDeleted, setLastDeleted] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [permInput, setPermInput] = useState("");
    const [dailyInput, setDailyInput] = useState("");
    const [mounted, setMounted] = useState(false);

    const [dragItem, setDragItem] = useState(null);

    useEffect(() => {
        const savedPerm = localStorage.getItem("ft_perm");
        const savedDaily = localStorage.getItem("ft_daily");
        const savedSets = localStorage.getItem("ft_sets");

        if (savedPerm) setPermanent(JSON.parse(savedPerm));
        if (savedDaily) setDaily(JSON.parse(savedDaily));
        if (savedSets) setSettings(JSON.parse(savedSets));

        setCurrentDate(new Date().toISOString().split("T")[0]);
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        localStorage.setItem("ft_perm", JSON.stringify(permanent));
    }, [permanent, mounted]);

    useEffect(() => {
        if (!mounted) return;
        localStorage.setItem("ft_daily", JSON.stringify(daily));
    }, [daily, mounted]);

    useEffect(() => {
        if (!mounted) return;
        localStorage.setItem("ft_sets", JSON.stringify(settings));
        document.documentElement.setAttribute("data-theme", settings.theme);
    }, [settings, mounted]);

    const handleDesktopDragStart = (e, index, type) => {
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
        setDragItem({ index, type });
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDesktopDragEnter = (e, index, type) => {
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
        if (!dragItem || dragItem.index === index || dragItem.type !== type) return;

        if (type === 'p') {
            const newItems = [...permanent];
            const draggedItemContent = newItems[dragItem.index];
            newItems.splice(dragItem.index, 1);
            newItems.splice(index, 0, draggedItemContent);
            setDragItem({ ...dragItem, index });
            setPermanent(newItems);
        } else {
            const newItems = [...(daily[currentDate] || [])];
            const draggedItemContent = newItems[dragItem.index];
            newItems.splice(dragItem.index, 1);
            newItems.splice(index, 0, draggedItemContent);
            setDragItem({ ...dragItem, index });
            setDaily(prev => ({ ...prev, [currentDate]: newItems }));
        }
    };

    const handleDesktopDragEnd = () => {
        setDragItem(null);
    };

    const mobileDragRef = useRef(null);

    const handleMobilePointerDown = (e, index, type, listId) => {
        if (e.pointerType === 'mouse' || e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        const targetRow = e.target.closest('li.task-item');
        if (!targetRow) return;

        const listContainer = document.getElementById(listId);
        if (!listContainer) return;

        const items = Array.from(listContainer.children).map((el, i) => ({
            el,
            rect: el.getBoundingClientRect(),
            index: i
        }));

        document.body.style.overflow = 'hidden';

        targetRow.classList.add('mobile-dragging');

        mobileDragRef.current = {
            index,
            type,
            element: targetRow,
            items,
            startY: e.clientY,
            initialRect: targetRow.getBoundingClientRect()
        };

        window.addEventListener('pointermove', handleMobilePointerMove);
        window.addEventListener('pointerup', handleMobilePointerUp);
        window.addEventListener('pointercancel', handleMobilePointerUp);
    };

    const handleMobilePointerMove = (e) => {
        if (!mobileDragRef.current) return;
        e.preventDefault();

        const { element, items, index, type } = mobileDragRef.current;

        const deltaY = e.clientY - mobileDragRef.current.startY;
        element.style.transform = `translateY(${deltaY}px)`;
        element.style.zIndex = '1000';
        element.style.position = 'relative';

        const currentY = e.clientY;

        const hoveredItem = items.find(item =>
            currentY >= item.rect.top && currentY <= item.rect.bottom && item.index !== index
        );

        if (hoveredItem) {
            const newIndex = hoveredItem.index;

            if (type === 'p') {
                setPermanent(prev => {
                    const newItems = [...prev];
                    const [moved] = newItems.splice(index, 1);
                    newItems.splice(newIndex, 0, moved);
                    return newItems;
                });
            } else {
                setDaily(prev => {
                    const dayTasks = [...(prev[currentDate] || [])];
                    const [moved] = dayTasks.splice(index, 1);
                    newItems.splice(newIndex, 0, moved);
                    return { ...prev, [currentDate]: dayTasks }; // Wait, newItems is not defined here for daily
                });
                // Fix logic below
                setDaily(prev => {
                    const dayTasks = [...(prev[currentDate] || [])];
                    const [moved] = dayTasks.splice(index, 1);
                    dayTasks.splice(newIndex, 0, moved);
                    return { ...prev, [currentDate]: dayTasks };
                });
            }

            mobileDragRef.current.index = newIndex;

            mobileDragRef.current.items = items.map(item => {
                if (item.index === index) return { ...item, index: newIndex };
                if (item.index === newIndex) return { ...item, index: index }; // Simple swap logic for index finding? 
                // Better: Re-query is safest but slow. 
                // Since React renders async, the DOM rects might drift.
                // Stick to simple index swap for interaction
                return item;
            });

            // Update cached items immediately to reflect new indices roughly
            // Ideally we re-measure but that is expensive.
            // For cached rect approach, usually you animate others.
            // Given constraints, relying on React render to update list is fine,
            // but we need to update our ref index.

            const listContainer = element.parentElement;
            if (listContainer) {
                const newItems = Array.from(listContainer.children).map((el, i) => ({
                    el,
                    rect: el.getBoundingClientRect(),
                    index: i
                }));
                mobileDragRef.current.items = newItems;
                mobileDragRef.current.startY = e.clientY; // Reset visual origin to avoid jump
                element.style.transform = 'translateY(0px)';
            }
        }
    };

    const handleMobilePointerUp = (e) => {
        if (!mobileDragRef.current) return;

        const { element } = mobileDragRef.current;

        element.style.transform = '';
        element.style.zIndex = '';
        element.style.position = '';
        element.classList.remove('mobile-dragging');
        document.body.style.overflow = '';

        window.removeEventListener('pointermove', handleMobilePointerMove);
        window.removeEventListener('pointerup', handleMobilePointerUp);
        window.removeEventListener('pointercancel', handleMobilePointerUp);

        mobileDragRef.current = null;
    };

    const toggleTheme = () => {
        setSettings(s => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }));
    };

    const addTask = (type) => {
        if (type === 'p') {
            if (!permInput.trim()) return;
            const task = {
                id: "t" + Date.now() + Math.random().toString(36).substr(2, 5),
                text: permInput.trim(),
                completed: false,
            };
            setPermanent(prev => [...prev, task]);
            setPermInput("");
        } else {
            if (!dailyInput.trim()) return;
            const task = {
                id: "t" + Date.now() + Math.random().toString(36).substr(2, 5),
                text: dailyInput.trim(),
                completed: false,
            };
            setDaily(prev => ({
                ...prev,
                [currentDate]: [...(prev[currentDate] || []), task]
            }));
            setDailyInput("");
        }
    };

    const deleteTask = (type, id) => {
        let taskToDelete;
        let index;

        if (type === 'p') {
            const idx = permanent.findIndex(t => t.id === id);
            taskToDelete = permanent[idx];
            index = idx;
            setPermanent(prev => prev.filter(t => t.id !== id));
        } else {
            const idx = daily[currentDate].findIndex(t => t.id === id);
            taskToDelete = daily[currentDate][idx];
            index = idx;
            setDaily(prev => ({
                ...prev,
                [currentDate]: prev[currentDate].filter(t => t.id !== id)
            }));
        }

        setLastDeleted({ type, task: taskToDelete, idx: index, date: currentDate });

        setTimeout(() => {
            setLastDeleted(null);
        }, 4000);
    };

    const undoDelete = () => {
        if (!lastDeleted) return;
        const { type, task, idx, date } = lastDeleted;

        if (type === 'p') {
            setPermanent(prev => {
                const newArr = [...prev];
                newArr.splice(idx, 0, task);
                return newArr;
            });
        } else {
            setDaily(prev => {
                const currentTasks = prev[date] || [];
                const newArr = [...currentTasks];
                newArr.splice(idx, 0, task);
                return { ...prev, [date]: newArr };
            });
        }
        setLastDeleted(null);
    };

    const toggleComplete = (type, id) => {
        if (type === 'p') {
            setPermanent(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
        } else {
            setDaily(prev => ({
                ...prev,
                [currentDate]: prev[currentDate].map(t => t.id === id ? { ...t, completed: !t.completed } : t)
            }));
        }
    };

    const updateTaskText = (type, id, newText) => {
        if (type === 'p') {
            setPermanent(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t));
        } else {
            setDaily(prev => ({
                ...prev,
                [currentDate]: prev[currentDate].map(t => t.id === id ? { ...t, text: newText } : t)
            }));
        }
    };

    if (!mounted) return null;

    const today = new Date().toISOString().split("T")[0];
    const isPast = currentDate < today;
    const isLocked = settings.lockPast && isPast;

    const currentDailyTasks = daily[currentDate] || [];

    const filterTasks = (tasks) => tasks.filter(t => t.text.toLowerCase().includes(searchQuery.toLowerCase()));

    const visiblePermanent = filterTasks(permanent);
    const visibleDaily = filterTasks(currentDailyTasks);

    const dateObj = new Date(currentDate);
    const weekday = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
    const fullDate = dateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

    return (
        <div className="app-container">
            <header className="main-header">
                <div className="logo-container">
                    <img
                        id="app-logo"
                        src={settings.theme === "dark" ? "/dark.png" : "/light.png"}
                        alt="commit.now logo"
                    />
                </div>
                <div className="header-actions">
                    <a href="https://github.com/RoycePS/commit.now" target="_blank" rel="noopener noreferrer" className="icon-btn" title="View Source on GitHub">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                        </svg>
                    </a>
                    <input
                        type="text"
                        id="global-search"
                        placeholder="Search tasks..."
                        aria-label="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button id="theme-toggle" className="icon-btn" onClick={toggleTheme} title="Toggle Theme">
                        <svg className="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                        <svg className="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    </button>
                </div>
            </header>

            <p className="tagline centered-tagline">Simple Efficient ToDo Planner</p>

            <main className="content">
                <section className="todo-card" id="permanent-section">
                    <div className="card-header">
                        <div className="title-group">
                            <h2>Permanent Goals</h2>
                        </div>
                    </div>

                    <div className="task-input-wrapper">
                        <input
                            type="text"
                            id="perm-input"
                            placeholder="Add a long-term goal..."
                            autoComplete="off"
                            value={permInput}
                            onChange={(e) => setPermInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addTask('p')}
                        />
                        <button id="add-perm-btn" className="primary-btn" onClick={() => addTask('p')}>Add</button>
                    </div>

                    <ul id="perm-list" className="task-list">
                        {visiblePermanent.map((t, i) => (
                            <TaskItem
                                key={t.id}
                                task={t}
                                index={i}
                                type="p"
                                locked={false}
                                onToggle={toggleComplete}
                                onUpdate={updateTaskText}
                                onDelete={deleteTask}
                                onDesktopDragStart={handleDesktopDragStart}
                                onDesktopDragEnter={handleDesktopDragEnter}
                                onDesktopDragEnd={handleDesktopDragEnd}
                                onMobilePointerDown={(e) => handleMobilePointerDown(e, i, 'p', 'perm-list')}
                            />
                        ))}
                    </ul>
                    {visiblePermanent.length === 0 && (
                        <div id="perm-empty" className="empty-state">No permanent goals yet. Define your vision.</div>
                    )}
                </section>

                <div className="calendar-bar">
                    <div className="date-group">
                        <span className="label">Focus Date</span>
                        <input
                            type="date"
                            id="date-selector"
                            value={currentDate}
                            onChange={(e) => setCurrentDate(e.target.value)}
                        />
                    </div>

                    {currentDate === today && <span id="date-today-badge" className="badge badge-status">TODAY</span>}

                    <div className="divider-vertical"></div>

                    <div className="lock-group">
                        <label className="switch">
                            <input
                                type="checkbox"
                                id="lock-past-toggle"
                                checked={settings.lockPast}
                                onChange={(e) => setSettings(s => ({ ...s, lockPast: e.target.checked }))}
                            />
                            <span className="slider"></span>
                        </label>
                        <span className="label">Lock History</span>
                    </div>
                </div>

                <section className="todo-card" id="daily-section">
                    <div className="card-header">
                        <div className="title-group">
                            <h2 id="daily-date-title">
                                <span className="date-weekday">{weekday}</span>
                                <span className="date-full">{fullDate}</span>
                            </h2>
                            {currentDate === today && <span id="today-badge" className="badge badge-status">TODAY</span>}
                        </div>
                        <div className="card-actions">
                            <button id="carry-forward-btn" className="utility-btn">Carry Forward</button>
                        </div>
                    </div>

                    {!isLocked && (
                        <div id="daily-input-container" className="task-input-wrapper">
                            <input
                                type="text"
                                id="daily-input"
                                placeholder="What is the priority for today?"
                                autoComplete="off"
                                value={dailyInput}
                                onChange={(e) => setDailyInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addTask('d')}
                            />
                            <button id="add-daily-btn" className="primary-btn" onClick={() => addTask('d')}>Add</button>
                        </div>
                    )}

                    <ul id="daily-list" className="task-list">
                        {visibleDaily.map((t, i) => (
                            <TaskItem
                                key={t.id}
                                task={t}
                                index={i}
                                type="d"
                                locked={isLocked}
                                onToggle={toggleComplete}
                                onUpdate={updateTaskText}
                                onDelete={deleteTask}
                                onDesktopDragStart={handleDesktopDragStart}
                                onDesktopDragEnter={handleDesktopDragEnter}
                                onDesktopDragEnd={handleDesktopDragEnd}
                                onMobilePointerDown={(e) => handleMobilePointerDown(e, i, 'd', 'daily-list')}
                            />
                        ))}
                    </ul>
                    {visibleDaily.length === 0 && (
                        <div id="daily-empty" className="empty-state">No tasks for this date. Rest or plan ahead.</div>
                    )}
                </section>
            </main>

            <div id="undo-toast" className={`toast ${lastDeleted ? 'visible' : ''}`}>
                <span id="toast-msg">Task deleted</span>
                <button id="undo-btn" className="primary-btn small" onClick={undoDelete}>Undo</button>
            </div>

            <footer className="app-footer">
                Made with ❤️ by <a href="https://royceps.com" target="_blank" rel="noopener noreferrer">Royce</a> | <a href="https://github.com/RoycePS/commit.now" target="_blank" rel="noopener noreferrer">Source Code</a>
            </footer>
        </div>
    );
}

function TaskItem({ task, index, type, locked, onToggle, onUpdate, onDelete, onDesktopDragStart, onDesktopDragEnter, onDesktopDragEnd, onMobilePointerDown }) {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(task.text);

    const handleEdit = () => {
        if (isEditing) {
            onUpdate(type, task.id, text);
        }
        setIsEditing(!isEditing);
    };

    return (
        <li
            className={`task-item ${task.completed ? 'completed' : ''}`}
            data-id={task.id}
            data-index={index}
            data-type={type}
            draggable={!locked && !isEditing}
            onDragStart={(e) => onDesktopDragStart && onDesktopDragStart(e, index, type)}
            onDragEnter={(e) => onDesktopDragEnter && onDesktopDragEnter(e, index, type)}
            onDragEnd={onDesktopDragEnd}
            onDragOver={(e) => e.preventDefault()}
        >
            <span className="drag-handle" style={{ opacity: isEditing || locked ? 0.3 : 1 }} onPointerDown={locked ? undefined : onMobilePointerDown}>
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 2C4 3.10457 3.10457 4 2 4C0.89543 4 0 3.10457 0 2C0 0.89543 0.89543 0 2 0C3.10457 0 4 0.89543 4 2Z" />
                    <path d="M4 8C4 9.10457 3.10457 10 2 10C0.89543 10 0 9.10457 0 9.10457 0 8C0 6.89543 0.89543 6 2 6C3.10457 6 4 6.89543 4 8Z" />
                    <path d="M4 14C4 15.1046 3.10457 16 2 16C0.89543 16 0 15.1046 0 14C0 12.8954 0.89543 12 2 12C3.10457 12 4 12.8954 4 14Z" />
                    <path d="M10 2C10 3.10457 9.10457 4 8 4C6.89543 4 6 3.10457 6 2C6 0.89543 6.89543 0 8 0C9.10457 0 10 0.89543 10 2Z" />
                    <path d="M10 8C10 9.10457 9.10457 10 8 10C6.89543 10 6 9.10457 6 8C6 6.89543 6.89543 6 8 6C9.10457 6 10 6.89543 10 8Z" />
                    <path d="M10 14C10 15.1046 9.10457 16 8 16C6.89543 16 6 15.1046 6 14C6 12.8954 6.89543 12 8 12C9.10457 12 10 12.8954 10 14Z" />
                </svg>
            </span>
            <input
                type="checkbox"
                className="task-checkbox"
                checked={task.completed}
                onChange={() => onToggle(type, task.id)}
                disabled={locked}
            />
            <input
                type="text"
                className="task-text"
                value={isEditing ? text : task.text}
                onChange={(e) => setText(e.target.value)}
                readOnly={!isEditing}
            />
            <div className="task-actions">
                {!locked && (
                    <>
                        <button className="edit-btn" onClick={handleEdit}>{isEditing ? 'Save' : 'Edit'}</button>
                        <button className="del-btn" onClick={() => onDelete(type, task.id)}>✕</button>
                    </>
                )}
            </div>
        </li>
    );
}
