const monthInput = document.querySelector('#month');
const sheet = document.querySelector('#sheet');
const status = document.querySelector('#status');
const storagePrefix = 'blood-pressure-log:v1:';
const viewMessage = '閲覧専用';
const periods = [['朝', 'morning'], ['昼', 'noon'], ['夜', 'night']];
let records = {};
let publishedRecords = {};
let publishedRecordsFailed = false;

function monthValue(date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function cell(row, tag, label, attributes = {}) {
  const element = document.createElement(tag);
  element.textContent = label;
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  row.append(element);
  return element;
}

function makeTable(first, last) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrap';
  const label = `${first}日〜${last}日`;
  const table = document.createElement('table');
  table.setAttribute('aria-label', label);
  const widths = document.createElement('colgroup');
  for (const width of [4, 9, 4, 10, 4, 9, 4, 10, 4, 9, 4, 10, 4, 7, 8]) {
    const column = document.createElement('col');
    column.style.width = `${width}%`;
    widths.append(column);
  }
  table.append(widths);
  const head = table.createTHead();
  const groups = head.insertRow();
  const columns = head.insertRow();
  cell(groups, 'th', '測定日', { rowspan: 2, scope: 'col' });
  for (const [period, className] of periods) {
    cell(groups, 'th', period, { colspan: 4, class: className });
    for (const heading of ['時刻', '服薬', '血圧 (mmHg)', '脈拍/分']) {
      cell(columns, 'th', heading, { scope: 'col', class: className });
    }
  }
  cell(groups, 'th', '体重 (kg)', { rowspan: 2, scope: 'col' });
  cell(groups, 'th', '生活メモ', { rowspan: 2, scope: 'col' });
  const body = table.createTBody();
  for (let day = first; day <= last; day++) {
    const row = body.insertRow();
    const publishedDay = publishedRecords[monthInput.value]?.[day] ?? {};
    cell(row, 'th', String(day), { scope: 'row' });
    for (const [period] of periods) {
      const key = day + ':' + period + ':';
      const measurement = publishedDay[period] ?? {};
      const value = name => measurement[name] ?? records[key + name] ?? '';
      const sys = value('sys');
      const dia = value('dia');
      cell(row, 'td', value('time'));
      cell(row, 'td', value('med') === true ? '✓' : '');
      cell(row, 'td', sys || dia ? sys + ' / ' + dia : '');
      cell(row, 'td', value('pulse'));
    }
    // Keep reading the original daily weight key.
    cell(row, 'td', publishedDay.weight ?? records[day + ':昼:weight'] ?? '');
    const memo = publishedDay.memo ?? records[day + '::memo'] ?? '';
    cell(row, 'td', memo, { class: 'memo', title: memo });
  }
  wrapper.append(table);
  return wrapper;
}

function render() {
  const [year, month] = monthInput.value.split('-').map(Number);
  const end = new Date(2000, month, 0);
  end.setFullYear(year, month, 0);
  status.textContent = publishedRecordsFailed ? '公開記録を読み込めませんでした。' : viewMessage;
  try {
    records = JSON.parse(localStorage.getItem(storagePrefix + monthInput.value)) ?? {};
  } catch {
    records = {};
    status.textContent = 'このブラウザの保存データを読み込めませんでした。';
  }
  document.querySelector('#month-title').textContent = `${year}年${month}月 血圧記録表`;
  sheet.replaceChildren(makeTable(1, 17), makeTable(18, end.getDate()));
}

function shiftMonth(offset) {
  const [year, month] = monthInput.value.split('-').map(Number);
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, month - 1 + offset);
  if (date.getFullYear() < 1 || date.getFullYear() > 9999) return;
  monthInput.value = monthValue(date);
  render();
}

let selectedMonth = monthValue(new Date());
monthInput.value = selectedMonth;
monthInput.addEventListener('change', () => {
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(monthInput.value) || monthInput.value.startsWith('0000')) {
    monthInput.value = selectedMonth;
    return;
  }
  selectedMonth = monthInput.value;
  render();
});
document.querySelector('#previous').addEventListener('click', () => {
  shiftMonth(-1);
  selectedMonth = monthInput.value;
});
document.querySelector('#next').addEventListener('click', () => {
  shiftMonth(1);
  selectedMonth = monthInput.value;
});
document.querySelector('#print').addEventListener('click', () => window.print());
render();
fetch('records.json', { cache: 'no-cache' })
  .then(response => {
    if (!response.ok) throw new Error('Could not load published records');
    return response.json();
  })
  .then(data => { publishedRecords = data; })
  .catch(() => { publishedRecordsFailed = true; })
  .then(render);
