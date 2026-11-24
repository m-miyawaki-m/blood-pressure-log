const dayMilliseconds = 86400000;
const trendMonthInput = document.querySelector('#month');
const trendRangeInput = document.querySelector('#trend-range');
const trendPeriodInput = document.querySelector('#trend-period');
let trendRecords = {};
const pressureFields = [
  { key: 'sys', label: '最高血圧', color: '#a44437' },
  { key: 'dia', label: '最低血圧', color: '#205ba0' },
];
const weightSeries = [{ key: 'weight', label: '体重', color: '#18735c', dashed: true }];

function pressureSeries(periods) {
  return periods.flatMap(period => pressureFields.map(field => ({
    ...field, key: period + ':' + field.key, label: period + 'の' + field.label, dashed: period === '夜',
  })));
}

function trendDate(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}

function trendNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function trendPoints(start, end, periods) {
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
    for (const period of periods) {
      for (const { key } of pressureFields) {
        point[period + ':' + key] = trendNumber(entry[period]?.[key] ?? local[[day, period, key].join(':')]);
      }
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

function trendScale(points, series, minimumStep) {
  const values = series.flatMap(({ key }) => points.map(point => point[key]).filter(value => value !== null));
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = Math.max(minimumStep, Math.ceil((max - min) / (4 * minimumStep)) * minimumStep);
  let lower = Math.floor(min / step) * step;
  let upper = Math.ceil(max / step) * step;
  if (lower === upper) {
    lower -= step;
    upper += step;
  }
  return { lower, upper, step };
}

function renderTrendChart(container, points, ticks, pressure) {
  container.replaceChildren();
  const trendAxes = [
    { series: pressure, unit: 'mmHg', label: '血圧（mmHg）', step: 10 },
    { series: weightSeries, unit: 'kg', label: '体重（kg）', step: 0.5, right: true },
  ];
  const axes = trendAxes.map(axis => ({ ...axis, scale: trendScale(points, axis.series, axis.step) }));
  if (!axes.some(axis => axis.scale)) {
    const empty = document.createElement('p');
    empty.textContent = 'この期間の記録はありません。';
    container.append(empty);
    return;
  }

  const left = 74;
  const right = 706;
  const top = 38;
  const bottom = 310;
  const x = index => left + index * (right - left) / (points.length - 1);
  const plot = chartElement(container, 'svg', {
    viewBox: '0 0 780 350', class: 'trend-plot', role: 'img',
    'aria-label': '血圧と体重の折れ線グラフ。左軸は血圧（mmHg）、右軸は体重（kg）',
  });
  const gridAxis = axes.find(axis => axis.scale);
  for (const axis of axes) {
    const edge = axis.right ? right : left;
    const colorClass = axis.right ? 'weight-axis' : '';
    chartElement(plot, 'text', { x: edge, y: 21, 'text-anchor': axis.right ? 'end' : 'start', class: colorClass }, axis.label);
    if (!axis.scale) continue;
    const { lower, upper, step } = axis.scale;
    const y = value => bottom - (value - lower) * (bottom - top) / (upper - lower);
    chartElement(plot, 'line', { x1: edge, y1: top, x2: edge, y2: bottom, class: 'grid' });
    for (let value = lower; value <= upper; value += step) {
      const height = y(value);
      if (axis === gridAxis) {
        chartElement(plot, 'line', { x1: left, y1: height, x2: right, y2: height, class: 'grid' });
      }
      chartElement(plot, 'line', { x1: edge, y1: height, x2: edge + (axis.right ? 5 : -5), y2: height, class: 'grid' });
      chartElement(plot, 'text', {
        x: edge + (axis.right ? 8 : -8), y: height + 6,
        'text-anchor': axis.right ? 'start' : 'end', class: colorClass,
      }, value.toFixed(axis.step < 1 ? 1 : 0));
    }
    drawTrendSeries(plot, points, axis.series, axis.unit, x, y);
  }
  for (const index of ticks) {
    const date = points[index].date;
    const label = (date.getUTCMonth() + 1) + '/' + date.getUTCDate();
    chartElement(plot, 'text', { x: x(index), y: bottom + 26, 'text-anchor': 'middle' }, label);
  }
}

function drawTrendSeries(plot, points, series, unit, x, y) {
  for (const { key, label, color, dashed } of series) {
    const coordinates = points.map((point, index) => point[key] === null ? '' :
      (index && points[index - 1][key] !== null ? 'L' : 'M') + x(index) + ',' + y(point[key]));
    chartElement(plot, 'path', {
      d: coordinates.join(' '), fill: 'none', stroke: color, 'stroke-width': 2.5,
      'stroke-dasharray': dashed ? '7 4' : 'none',
    });
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
  const periods = trendPeriodInput.value === 'both' ? ['朝', '夜'] : [trendPeriodInput.value];
  const pressure = pressureSeries(periods);
  const points = trendPoints(start, end, periods);
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round(index * (points.length - 1) / 4));
  const formatted = date => date.toISOString().slice(0, 10).replaceAll('-', '/');
  document.querySelector('#trend-dates').textContent = formatted(start) + ' 〜 ' + formatted(end);
  const legend = document.querySelector('#trend-legend');
  legend.replaceChildren();
  for (const { label, color, dashed } of [...pressure, ...weightSeries]) {
    const item = document.createElement('span');
    item.textContent = (dashed ? '┄ ' : '━ ') + label;
    item.style.color = color;
    legend.append(item);
  }
  renderTrendChart(document.querySelector('#combined-chart'), points, ticks, pressure);
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
trendPeriodInput.addEventListener('change', renderTrends);
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
