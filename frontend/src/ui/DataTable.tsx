import { useEffect, useMemo, useState } from 'react';
import { localizeField, localizeValue, useLanguage } from '../i18n';

export function DataTable({ rows, onRow }: { rows: Array<Record<string, unknown>>; onRow?: (row: Record<string, unknown>) => void }) {
  const language = useLanguage();
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const keys = useMemo(() => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8), [rows]);

  useEffect(() => {
    setPage(1);
  }, [rows, filters, sortKey, sortDirection, pageSize]);

  const filteredRows = useMemo(() => rows.filter((row) => keys.every((key) => {
    const filterValue = (filters[key] ?? '').trim().toLowerCase();
    if (!filterValue) return true;
    return String(row[key] ?? '').toLowerCase().includes(filterValue);
  })), [filters, keys, rows]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((leftRow, rightRow) => {
      const left = leftRow[sortKey];
      const right = rightRow[sortKey];
      const leftNumber = typeof left === 'number' ? left : Number(String(left ?? '').replace(',', '.'));
      const rightNumber = typeof right === 'number' ? right : Number(String(right ?? '').replace(',', '.'));
      const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
      const comparison = bothNumeric
        ? leftNumber - rightNumber
        : String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  if (!rows.length) return <p>{language === 'fr' ? 'Aucune donnée' : 'No data'}</p>;
  return (
    <div className="dataTable">
      <div className="tableScroller">
        <table>
          <thead>
            <tr>
              {keys.map((key) => (
                <th key={key}>
                  <button className="sortButton" onClick={() => toggleSort(key)}>
                    <span>{localizeField(language, key)}</span>
                    <span>{sortKey === key ? (sortDirection === 'asc' ? 'ASC' : 'DESC') : (language === 'fr' ? 'TRI' : 'SORT')}</span>
                  </button>
                  <input
                    className="columnFilter"
                    value={filters[key] ?? ''}
                    onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}
                    placeholder={`${language === 'fr' ? 'Filtrer' : 'Filter'} ${localizeField(language, key)}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={`${currentPage}-${index}`} onClick={() => onRow?.(row)}>
                {keys.map((key) => <td key={key}>{localizeValue(language, row[key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visibleRows.length && <p>{language === 'fr' ? 'Aucun résultat pour les filtres actifs.' : 'No results for the active filters.'}</p>}
      <div className="paginationBar">
        <span>{sortedRows.length} {language === 'fr' ? 'résultat(s)' : 'result(s)'} - page {currentPage} / {totalPages}</span>
        <label>
          {language === 'fr' ? 'Lignes' : 'Rows'}
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="paginationButtons">
          <button onClick={() => setPage(1)} disabled={currentPage === 1}>{language === 'fr' ? 'Première' : 'First'}</button>
          <button onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>{language === 'fr' ? 'Précédente' : 'Previous'}</button>
          <button onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>{language === 'fr' ? 'Suivante' : 'Next'}</button>
          <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>{language === 'fr' ? 'Dernière' : 'Last'}</button>
        </div>
      </div>
    </div>
  );
}
