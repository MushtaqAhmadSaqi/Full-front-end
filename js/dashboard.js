import { supabase, auth, escapeHtml } from './core.js';

let learningChart = null;
let lastChartPayload = { labels: [], data: [] };

const dashboardEls = {
  currentDate: () => document.getElementById('currentDate'),
  weakTopicsList: () => document.getElementById('weakTopicsList'),
  recentActivityList: () => document.getElementById('recentActivityList'),
  subjectMasteryList: () => document.getElementById('subjectMasteryList'),
  learningChart: () => document.getElementById('learningChart'),
  learningChartEmpty: () => document.getElementById('learningChartEmpty')
};

document.addEventListener('DOMContentLoaded', async () => {
  initDashboardDate();
  bindThemeRefresh();
  await initDashboard();
});

function bindThemeRefresh() {
  document.addEventListener('comsatsprephub:themechange', () => {
    const { labels, data } = lastChartPayload;

    renderLearningChart(labels, data).catch(error => {
      console.error('Dashboard chart refresh failed:', error);
    });
  });
}

function initDashboardDate() {
  const dateEl = dashboardEls.currentDate();
  if (!dateEl) return;

  dateEl.textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());
}

async function initDashboard() {
  try {
    const session = await auth.getSession();
    const user = session?.user;

    if (!user) {
      setGuestFallback();
      return;
    }

    const firstName = auth.getUserName(user);
    const fullName = user?.user_metadata?.full_name || firstName;

    setText('userFirstName', firstName);
    setText(
      'welcomeSubtext',
      `Great to have you back, ${fullName}. Your study progress, quiz scores, weak topics, and subject mastery are organized in one focused workspace.`
    );

    await loadDashboardData(user.id);
  } catch (error) {
    console.error('Dashboard init failed:', error);
    setGuestFallback();
  }
}

function setGuestFallback() {
  setText('userFirstName', 'Student');
  setText(
    'welcomeSubtext',
    'Sign in to track quiz scores, studied subjects, weak topics, and mastery trends in one clean dashboard.'
  );

  const emptyStats = {
    quizCount: 0,
    averageScore: 0,
    subjectsStudied: 0,
    studySessions: 0
  };

  renderDashboardStats(emptyStats);
  renderWeakTopics([]);
  renderRecentActivity([]);
  renderSubjectMastery([]);

  renderLearningChart([], []).catch(error => {
    console.error('Guest chart fallback failed:', error);
  });
}

async function loadDashboardData(userId) {
  const [quizAttemptsResult, subjectProgressResult, subjectsCatalogResult] =
    await Promise.allSettled([
      supabase
        .from('user_quiz_attempts')
        .select(
          'quiz_id, quiz_title, subject_code, score_percent, correct_answers, total_questions, completed_at'
        )
        .eq('user_id', userId)
        .order('completed_at', { ascending: false }),

      supabase
        .from('user_subject_progress')
        .select(
          'subject_code, subject_name, topic_name, mastery_percent, sessions_count, updated_at'
        )
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),

      supabase
        .from('past_papers')
        .select('subject_code, subject_name')
    ]);

  const quizAttempts = getSettledRows(quizAttemptsResult);
  const subjectProgress = getSettledRows(subjectProgressResult);
  const subjectsCatalog = getSettledRows(subjectsCatalogResult);

  logSettledError('Quiz attempts load error', quizAttemptsResult);
  logSettledError('Subject progress load error', subjectProgressResult);
  logSettledError('Subject catalog load error', subjectsCatalogResult);

  const subjectNameMap = buildSubjectNameMap(subjectsCatalog, subjectProgress);

  const stats = buildDashboardStats({
    quizAttempts,
    subjectProgress,
    subjectNameMap
  });

  renderDashboardStats(stats);
  renderWeakTopics(stats.weakTopics);
  renderRecentActivity(stats.recentActivity);
  renderSubjectMastery(stats.subjectMastery);
  await renderLearningChart(stats.chartLabels, stats.chartScores);
}

function getSettledRows(result) {
  return result.status === 'fulfilled' && !result.value.error
    ? result.value.data || []
    : [];
}

function logSettledError(label, result) {
  if (result.status === 'fulfilled' && result.value.error) {
    console.error(`${label}:`, result.value.error);
  }

  if (result.status === 'rejected') {
    console.error(`${label}:`, result.reason);
  }
}

function buildSubjectNameMap(subjectsCatalog, subjectProgress) {
  const map = new Map();

  [...subjectsCatalog, ...subjectProgress].forEach(item => {
    const code = String(item?.subject_code || '').trim();
    const name = String(item?.subject_name || '').trim();

    if (code && name && !map.has(code)) {
      map.set(code, name);
    }
  });

  return map;
}

function resolveSubjectLabel(subjectCode, subjectNameMap, fallbackName = '') {
  const code = String(subjectCode || '').trim();
  const label =
    String(fallbackName || '').trim() ||
    subjectNameMap.get(code) ||
    code ||
    'Untitled Subject';

  return { code, label };
}

function buildDashboardStats({ quizAttempts, subjectProgress, subjectNameMap }) {
  const quizCount = quizAttempts.length;

  const averageScore = quizCount
    ? Math.round(
        quizAttempts.reduce(
          (sum, item) => sum + Number(item.score_percent || 0),
          0
        ) / quizCount
      )
    : 0;

  const normalizedSubjectProgress = subjectProgress.map(item => {
    const subject = resolveSubjectLabel(
      item.subject_code,
      subjectNameMap,
      item.subject_name
    );

    return {
      ...item,
      subject_code: subject.code,
      subject_name: subject.label,
      mastery_percent: Number(item.mastery_percent || 0),
      sessions_count: Number(item.sessions_count || 0)
    };
  });

  const rootSubjectRows = normalizedSubjectProgress.filter(
    item => !item.topic_name
  );

  const studyRowsForActivity = rootSubjectRows.filter(
    item => item.sessions_count > 0 || item.mastery_percent > 0
  );

  const subjectsStudied = new Set(
    normalizedSubjectProgress
      .map(item => item.subject_code || item.subject_name)
      .filter(Boolean)
  ).size;

  const studySessions = rootSubjectRows.reduce(
    (sum, item) => sum + item.sessions_count,
    0
  );

  const weakTopics = normalizedSubjectProgress
    .filter(item => item.mastery_percent > 0 && item.mastery_percent < 65)
    .sort((a, b) => a.mastery_percent - b.mastery_percent)
    .slice(0, 5)
    .map(item => ({
      name: item.topic_name || item.subject_name,
      score: clampPercent(item.mastery_percent),
      subject: item.subject_code || item.subject_name
    }));

  const recentQuizActivity = quizAttempts.slice(0, 4).map(item => {
    const subject = resolveSubjectLabel(item.subject_code, subjectNameMap);
    const score = clampPercent(Number(item.score_percent || 0));

    return {
      type: 'quiz',
      title: item.quiz_title || `${subject.label} quiz`,
      meta: `${subject.code || subject.label} • ${score}% score`,
      score,
      date: item.completed_at
    };
  });

  const recentStudyActivity = studyRowsForActivity.slice(0, 4).map(item => ({
    type: 'study',
    title: `Studied ${item.subject_name}`,
    meta: `${item.sessions_count} session${
      item.sessions_count === 1 ? '' : 's'
    } • ${clampPercent(item.mastery_percent)}% mastery`,
    score: clampPercent(item.mastery_percent),
    date: item.updated_at
  }));

  const recentActivity = [...recentQuizActivity, ...recentStudyActivity]
    .filter(item => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  const masteryMap = new Map();

  normalizedSubjectProgress.forEach(item => {
    const key = item.subject_code || item.subject_name;
    if (!key) return;

    if (!masteryMap.has(key)) {
      masteryMap.set(key, {
        name: item.subject_name,
        code: item.subject_code,
        total: 0,
        count: 0,
        sessions: 0
      });
    }

    const existing = masteryMap.get(key);
    existing.total += clampPercent(item.mastery_percent);
    existing.count += 1;
    existing.sessions = Math.max(existing.sessions, item.sessions_count);
  });

  const subjectMastery = [...masteryMap.values()]
    .map(item => ({
      name: item.name,
      code: item.code,
      mastery: item.count ? Math.round(item.total / item.count) : 0,
      sessions: item.sessions
    }))
    .sort((a, b) =>
      b.mastery !== a.mastery ? b.mastery - a.mastery : b.sessions - a.sessions
    )
    .slice(0, 6);

  const chartItems = quizAttempts.slice(0, 8).reverse();
  const chartLabels = chartItems.map(
    (item, index) => item.quiz_title || `Quiz ${index + 1}`
  );
  const chartScores = chartItems.map(item =>
    clampPercent(Number(item.score_percent || 0))
  );

  return {
    quizCount,
    averageScore,
    subjectsStudied,
    studySessions,
    weakTopics,
    recentActivity,
    subjectMastery,
    chartLabels,
    chartScores
  };
}

function renderDashboardStats(stats) {
  const quizCount = Number(stats.quizCount || 0);
  const averageScore = clampPercent(Number(stats.averageScore || 0));
  const subjectsStudied = Number(stats.subjectsStudied || 0);
  const studySessions = Number(stats.studySessions || 0);

  setText('statQuizCount', quizCount);
  setText('statAverageScore', `${averageScore}%`);
  setText('statSubjectsStudied', subjectsStudied);
  setText('statStudySessions', studySessions);

  setText('pulseQuizCount', quizCount);
  setText('pulseAverageScore', `${averageScore}%`);
  setText('pulseSubjectsStudied', subjectsStudied);
  setText('averageScoreStatus', getScoreLabel(averageScore));
}

function renderWeakTopics(items) {
  const el = dashboardEls.weakTopicsList();
  if (!el) return;

  if (!items.length) {
    el.innerHTML = renderEmptyState({
      icon: 'verified',
      title: 'No weak topics yet',
      text:
        'Complete 2–3 quizzes first. Then this section will show what actually needs revision.',
      actions: [
        {
          href: 'quiz.html',
          label: 'Start diagnosis',
          variant: 'secondary',
          icon: 'play_arrow'
        }
      ]
    });
    return;
  }

  el.innerHTML = items
    .map(item => {
      const score = clampPercent(Number(item.score || 0));
      const severity = getWeakTopicSeverity(score);

      return `
        <article class="weak-topic-item ui-generated-card">
          <div class="weak-topic-main">
            <h3 class="weak-topic-title">${escapeHtml(item.name)}</h3>
            <p class="weak-topic-meta">${escapeHtml(item.subject)}</p>
          </div>

          <div class="weak-topic-result">
            <strong class="weak-topic-score ${severity.className}">${score}%</strong>
            <span class="weak-topic-severity ${severity.className}">
              ${escapeHtml(severity.label)}
            </span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderRecentActivity(items) {
  const el = dashboardEls.recentActivityList();
  if (!el) return;

  if (!items.length) {
    el.innerHTML = renderEmptyState({
      icon: 'history',
      title: 'No activity recorded yet',
      text:
        'Start a quiz or browse subjects to begin building your study history.',
      actions: [
        {
          href: 'quiz.html',
          label: 'Take Quiz',
          variant: 'primary',
          icon: 'quiz'
        },
        {
          href: 'subjects.html',
          label: 'Browse Subjects',
          variant: 'secondary',
          icon: 'menu_book'
        }
      ]
    });
    return;
  }

  el.innerHTML = items
    .map(item => {
      const isQuiz = item.type === 'quiz';
      const typeLabel = isQuiz ? 'Quiz' : 'Study';
      const icon = isQuiz ? 'quiz' : 'school';

      return `
        <article class="activity-item ui-generated-card">
          <div class="activity-icon" aria-hidden="true">
            <span class="material-symbols-outlined">${icon}</span>
          </div>

          <div class="activity-body">
            <div class="activity-topline">
              <h3 class="activity-title">${escapeHtml(item.title)}</h3>
              <span class="activity-type-chip">${typeLabel}</span>
            </div>

            <p class="activity-meta">${escapeHtml(item.meta)}</p>
            <time class="activity-date" datetime="${escapeHtml(
              item.date || ''
            )}">
              ${formatRelativeDate(item.date)}
            </time>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderSubjectMastery(items) {
  const el = dashboardEls.subjectMasteryList();
  if (!el) return;

  if (!items.length) {
    el.innerHTML = renderEmptyState({
      icon: 'stacked_bar_chart',
      title: 'No subject progress yet',
      text:
        'Study at least one subject and attempt related quizzes to unlock mastery tracking.',
      actions: [
        {
          href: 'subjects.html',
          label: 'Browse subjects',
          variant: 'secondary',
          icon: 'menu_book'
        }
      ]
    });
    return;
  }

  el.innerHTML = items
    .map(item => {
      const mastery = clampPercent(Number(item.mastery || 0));
      const status = getMasteryStatus(mastery);

      return `
        <article class="mastery-item ui-generated-card">
          <div class="mastery-header">
            <div>
              <h3 class="mastery-title">${escapeHtml(item.name)}</h3>
              <p class="mastery-meta">
                ${escapeHtml(item.code || 'Subject')} • ${Number(
                  item.sessions || 0
                )} session${Number(item.sessions || 0) === 1 ? '' : 's'}
              </p>
            </div>

            <strong class="mastery-score ${status.className}">
              ${mastery}%
            </strong>
          </div>

          <div class="mastery-progress" aria-hidden="true">
            <span style="width: ${mastery}%"></span>
          </div>

          <span class="mastery-status-chip ${status.className}">
            ${escapeHtml(status.label)}
          </span>
        </article>
      `;
    })
    .join('');
}

async function renderLearningChart(labels, data) {
  lastChartPayload = {
    labels: [...labels],
    data: [...data]
  };

  const canvas = dashboardEls.learningChart();
  const empty = dashboardEls.learningChartEmpty();

  if (!canvas) return;

  if (!labels.length || !data.length) {
    if (learningChart) {
      learningChart.destroy();
      learningChart = null;
    }

    canvas.classList.add('hidden');
    empty?.classList.remove('hidden');

    if (empty && !empty.querySelector('.empty-state-actions')) {
      empty.insertAdjacentHTML(
        'beforeend',
        `
          <div class="empty-state-actions">
            <a href="quiz.html" class="btn-primary empty-state-cta">
              <span class="material-symbols-outlined" aria-hidden="true">play_arrow</span>
              Take your first quiz
            </a>
          </div>
        `
      );
    }

    return;
  }

  canvas.classList.remove('hidden');
  empty?.classList.add('hidden');

  const { Chart } = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm');

  const ctx = canvas.getContext('2d');

  if (learningChart) {
    learningChart.destroy();
  }

  const isDark = document.documentElement.classList.contains('dark');
  const borderColor = isDark ? '#60a5fa' : '#2563eb';
  const secondaryColor = isDark ? '#22d3ee' : '#06b6d4';
  const gridColor = isDark
    ? 'rgba(148, 163, 184, 0.14)'
    : 'rgba(15, 23, 42, 0.07)';
  const textColor = isDark ? '#cbd5e1' : '#64748b';
  const pointBg = isDark ? '#020617' : '#ffffff';

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(
    0,
    isDark ? 'rgba(96,165,250,0.35)' : 'rgba(37,99,235,0.20)'
  );
  gradient.addColorStop(
    0.55,
    isDark ? 'rgba(34,211,238,0.10)' : 'rgba(6,182,212,0.08)'
  );
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  learningChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Score',
          data,
          borderColor,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: pointBg,
          pointBorderColor: secondaryColor,
          pointBorderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion()
        ? false
        : {
            duration: 650,
            easing: 'easeOutQuart'
          },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          displayColors: false,
          backgroundColor: isDark
            ? 'rgba(15,23,42,0.97)'
            : 'rgba(255,255,255,0.98)',
          titleColor: isDark ? '#ffffff' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#475569',
          borderColor: isDark
            ? 'rgba(255,255,255,0.10)'
            : 'rgba(15,23,42,0.08)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 14,
          callbacks: {
            label: context => `Score: ${context.parsed.y}%`
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: textColor,
            maxRotation: 0,
            autoSkip: true,
            callback(value) {
              const label = this.getLabelForValue(value);
              return label.length > 14 ? `${label.slice(0, 14)}…` : label;
            }
          },
          border: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: textColor,
            stepSize: 20,
            callback: value => `${value}%`
          },
          grid: {
            color: gridColor,
            drawTicks: false
          },
          border: {
            display: false
          }
        }
      }
    }
  });
}

function renderEmptyState({ icon, title, text, actions = [] }) {
  const actionMarkup =
    Array.isArray(actions) && actions.length
      ? `
        <div class="empty-state-actions">
          ${actions
            .map(action => {
              const variant =
                action.variant === 'secondary' ? 'btn-secondary' : 'btn-primary';

              const iconMarkup = action.icon
                ? `<span class="material-symbols-outlined" aria-hidden="true">${escapeHtml(
                    action.icon
                  )}</span>`
                : '';

              return `
                <a href="${escapeHtml(
                  action.href || '#'
                )}" class="${variant} empty-state-cta">
                  ${iconMarkup}
                  ${escapeHtml(action.label || 'Continue')}
                </a>
              `;
            })
            .join('')}
        </div>
      `
      : '';

  return `
    <div class="empty-state dashboard-empty-state ui-empty-state-enhanced">
      <span class="material-symbols-outlined" aria-hidden="true">${escapeHtml(
        icon
      )}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${actionMarkup}
    </div>
  `;
}

function getWeakTopicSeverity(score) {
  if (score < 40) {
    return {
      label: 'Critical focus',
      className: 'score-danger'
    };
  }

  if (score < 55) {
    return {
      label: 'Needs practice',
      className: 'score-warning'
    };
  }

  return {
    label: 'Close to safe',
    className: 'score-info'
  };
}

function getMasteryStatus(score) {
  if (score >= 80) {
    return {
      label: 'Strong command',
      className: 'mastery-strong'
    };
  }

  if (score >= 65) {
    return {
      label: 'Good progress',
      className: 'mastery-good'
    };
  }

  if (score >= 40) {
    return {
      label: 'Needs revision',
      className: 'mastery-watch'
    };
  }

  return {
    label: 'Start focused practice',
    className: 'mastery-low'
  };
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent momentum';
  if (score >= 65) return 'Good, keep pushing';
  if (score > 0) return 'Needs focused revision';
  return 'No score yet';
}

function clampPercent(value) {
  const numeric = Number(value || 0);

  if (Number.isNaN(numeric)) return 0;

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatRelativeDate(value) {
  if (!value) return 'Recently';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function prefersReducedMotion() {
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}
