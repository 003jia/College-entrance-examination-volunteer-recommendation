export interface CsvTable {
  headers: string[];
  rows: Array<Record<string, string>>;
}

/**
 * 解析 CSV 文本（RFC 4180 子集）：支持引号字段、字段内逗号/换行、双引号转义、
 * CRLF 与 UTF-8 BOM。考试院导出的 Excel 转 CSV 后可直接解析。
 */
export function parseCsv(text: string): CsvTable {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    // 跳过完全空白的行
    if (record.length > 1 || record[0].trim() !== '') records.push(record);
    record = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRecord();
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || record.length) pushRecord();

  if (!records.length) return { headers: [], rows: [] };

  const headers = records[0].map((header) => header.trim());
  const rows = records.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}
