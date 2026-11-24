const dayMilliseconds = 86400000;
const trendMonthInput = document.querySelector('#month');
const trendRangeInput = document.querySelector('#trend-range');
const trendPeriods = ['朝', '昼', '夜'];
let trendRecords = {};
const bloodPressureSeries = [
  { key: 'sys', label: '最高血圧', color: '#a44437' },
  { key: 'dia', label: '最低血圧', color: '#205ba0' },
];
const weightSeries = [{ key: 'weight', label: '体重', color: '#18735c' }];

function trendDate(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}

function trendNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function trendPoints(start, end) {
  const points = [];
  let previousMonth;
  let local;
  for (let time = +start; time <= +end; time += dayMilliseconds) {
    const date = new Date(time);
    const month = date.toISOString().slice(0, 7);
    const day = date.getUTCDate();
    if (month !== previousMonth) {
      previousMonth = month;
      try {
        local = JSON.parse(localStorage.getItem('blood-pressure-log:v1:' + month)) ?? {};
      } catch {
        local = {};
      }
    }
    const entry = trendRecords[month]?.[day] ?? {};
    const point = { date, weight: trendNumber(entry.weight ?? local[day + ':昼:weight']) };
    for (const { key } of bloodPressureSeries) {
      const values = trendPeriods.map(period => trendNumber(
        entry[period]?.[key] ?? local[[day, period, key].join(':')],
      )).filter(value => value !== null);
      point[key] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    }
    points.push(point);
  }
  return points;
}

function chartElement(parent, tag, attributes, label = '') {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  element.textContent = label;
  parent.append(element);
  return element;
}

function renderTrendChart(container, points, series, unit, ticks, minimumStep) {
  container.replaceChildren();
  const values = series.flatMap(({ key }) => points.map(point => point[key]).filter(value => value !== null));
  if (!values.length) {
    const empty = document.createElement('p');
    empty.textContent = 'この期間の記録はありません。';
    container.append(empty);
    return;
  }

  const left = 64;
  const right = 754;
  const top = 18;
  const bottom = 214;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = Math.max(minimumStep, Math.ceil((max - min) / (4 * minimumStep)) * minimumStep);
  let lower = Math.floor(min / step) * step;
  let upper = Math.ceil(max / step) * step;
  if (lower === upper) {
    lower -= step;
    upper += step;
  }
  const x = index => left + index * (right - left) / (points.length - 1);
  const y = value => bottom - (value - lower) * (bottom - top) / (upper - lower);
  const plot = chartElement(container, 'svg', {
    viewBox: '0 0 780 254', class: 'trend-plot', role: 'img',
    'aria-label': series.map(({ label }) => label).join('・') + 'の折れ線グラフ（' + unit + '）',
  });

  for (let value = lower; value <= upper; value += step) {
    const height = y(value);
    chartElement(plot, 'line', { x1: left, y1: height, x2: right, y2: height, class: 'grid' });
    chartElement(plot, 'text', { x: left - 8, y: height + 6, 'text-anchor': 'end' }, value.toFixed(minimumStep < 1 ? 1 : 0));
  }
  for (const index of ticks) {
    const date = points[index].date;
    const label = (date.getUTCMonth() + 1) + '/' + date.getUTCDate();
    chartElement(plot, 'text', { x: x(index), y: bottom + 26, 'text-anchor': 'middle' }, label);
  }

  for (const { key, label, color } of series) {
    const coordinates = points.map((point, index) => point[key] === null ? '' :
      (index && points[index - 1][key] !== null ? 'L' : 'M') + x(index) + ',' + y(point[key]));
    chartElement(plot, 'path', { d: coordinates.join(' '), fill: 'none', stroke: color, 'stroke-width': 2.5 });
    points.forEach((point, index) => {
      if (point[key] === null) return;
      const dot = chartElement(plot, 'circle', { cx: x(index), cy: y(point[key]), r: 3, fill: color });
      chartElement(dot, 'title', {}, point.date.toISOString().slice(0, 10) + ' ' + label + ' ' + point[key].toFixed(1) + ' ' + unit);
    });
  }
}

function renderTrends() {
  const [year, month] = trendMonthInput.value.split('-').map(Number);
  const months = Number(trendRangeInput.value);
  const firstMonth = Math.max(month - months, (1 - year) * 12);
  const start = trendDate(year, firstMonth, 1);
  const end = trendDate(year, month, 0);
  const points = trendPoints(start, end);
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round(index * (points.length - 1) / 4));
  const formatted = date => date.toISOString().slice(0, 10).replaceAll('-', '/');
  document.querySelector('#trend-dates').textContent = formatted(start) + ' 〜 ' + formatted(end);
  renderTrendChart(document.querySelector('#pressure-chart'), points, bloodPressureSeries, 'mmHg', ticks, 10);
  renderTrendChart(document.querySelector('#weight-chart'), points, weightSeries, 'kg', ticks, 0.5);
  document.querySelector('#record-link').href = './?month=' + trendMonthInput.value;
}

function validTrendMonth(value) {
  return /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith('0000');
}

const today = new Date();
const currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
const linkedMonth = new URLSearchParams(location.search).get('month');
let selectedTrendMonth = validTrendMonth(linkedMonth) ? linkedMonth : currentMonth;
trendMonthInput.value = selectedTrendMonth;
trendMonthInput.addEventListener('change', () => {
  if (!validTrendMonth(trendMonthInput.value)) {
    trendMonthInput.value = selectedTrendMonth;
    return;
  }
  selectedTrendMonth = trendMonthInput.value;
  renderTrends();
});
trendRangeInput.addEventListener('change', renderTrends);
renderTrends();
fetch('records.json', { cache: 'no-cache' })
  .then(response => {
    if (!response.ok) throw new Error('Could not load published records');
    return response.json();
  })
  .then(data => {
    trendRecords = data;
    renderTrends();
  })
  .catch(() => {
    document.querySelector('#trend-status').textContent = '公開記録を読み込めませんでした。';
  });
