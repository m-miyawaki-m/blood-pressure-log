const monthInput = document.querySelector('#month');
const sheet = document.querySelector('#sheet');
const status = document.querySelector('#status');
const storagePrefix = 'blood-pressure-log:v1:';
const savedMessage = '入力はこのブラウザに自動保存されます。';
let records = {};

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

function measurementField(container, day, period, name, type, label) {
  const key = `${day}:${period}:${name}`;
  const input = document.createElement('input');
  input.type = type;
  input.setAttribute('aria-label', `${day}日 ${period} ${label}`.trim());
  if (type === 'number') {
    input.min = '1';
    input.max = '999';
    input.inputMode = 'numeric';
  }
  if (type === 'checkbox') {
    input.checked = records[key] === true;
  } else {
    input.value = records[key] ?? '';
  }
  const value = () => type === 'checkbox' ? input.checked : input.value;
  const printValue = document.createElement('span');
  printValue.className = 'print-value';
  const updatePrint = () => {
    printValue.textContent = type === 'checkbox' ? (input.checked ? '✓' : '') : input.value;
  };
  input.addEventListener('input', () => {
    if (!input.validity.valid) {
      status.textContent = '数値は1〜999の整数で入力してください。';
      return;
    }
    records[key] = value();
    updatePrint();
    try {
      localStorage.setItem(storagePrefix + monthInput.value, JSON.stringify(records));
      status.textContent = savedMessage;
    } catch {
      status.textContent = 'このブラウザに保存できませんでした。';
    }
  });
  updatePrint();
  container.append(input, printValue);
  return input;
}

function makeTable(first, last) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrap';
  const label = `${first}日〜${last}日`;
  const table = document.createElement('table');
  table.setAttribute('aria-label', label);
  const widths = document.createElement('colgroup');
  for (const width of [7, 13, 6, 15, 8, 13, 6, 15, 8, 9]) {
    const column = document.createElement('col');
    column.style.width = `${width}%`;
    widths.append(column);
  }
  table.append(widths);
  const head = table.createTHead();
  const groups = head.insertRow();
  const columns = head.insertRow();
  cell(groups, 'th', '測定日', { rowspan: 2, scope: 'col' });
  for (const [period, className] of [['朝', 'morning'], ['夜', 'night']]) {
    cell(groups, 'th', period, { colspan: 4, class: className });
    for (const heading of ['測定時刻', '服薬', '血圧 (mmHg)', '脈拍/分']) {
      cell(columns, 'th', heading, { scope: 'col', class: className });
    }
  }
  cell(groups, 'th', '生活メモ', { rowspan: 2, scope: 'col' });
  const body = table.createTBody();
  for (let day = first; day <= last; day++) {
    const row = body.insertRow();
    cell(row, 'th', String(day), { scope: 'row' });
    for (const period of ['朝', '夜']) {
      measurementField(row.insertCell(), day, period, 'time', 'time', '測定時刻');
      measurementField(row.insertCell(), day, period, 'med', 'checkbox', '服薬');
      const pressure = row.insertCell();
      const pair = document.createElement('div');
      pair.className = 'pair';
      measurementField(pair, day, period, 'sys', 'number', '最高血圧');
      pair.append('/');
      measurementField(pair, day, period, 'dia', 'number', '最低血圧');
      pressure.append(pair);
      const printPressure = document.createElement('span');
      printPressure.className = 'print-value';
      const updatePressure = () => {
        const sys = records[`${day}:${period}:sys`] ?? '';
        const dia = records[`${day}:${period}:dia`] ?? '';
        printPressure.textContent = sys || dia ? `${sys} / ${dia}` : '';
      };
      pair.addEventListener('input', updatePressure);
      updatePressure();
      pressure.append(printPressure);
      measurementField(row.insertCell(), day, period, 'pulse', 'number', '脈拍');
    }
    measurementField(row.insertCell(), day, '', 'memo', 'text', '生活メモ');
  }
  wrapper.append(table);
  return wrapper;
}

function render() {
  const [year, month] = monthInput.value.split('-').map(Number);
  const end = new Date(2000, month, 0);
  end.setFullYear(year, month, 0);
  status.textContent = savedMessage;
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
