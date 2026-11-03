// Presentation-only explanation; never reclassifies or modifies observations.
// Evidence: data/linked/shoreline_index.json samples and
// data/linked/tables/analysis_input__lake_quality.json (2004-07, 2020-07).
// Report: data/content.json chapter-02-section-06 (p11),
// chapter-03-section-05 (p17), chapter-03-section-15 (p26).
// These two dates pass coverage screening; no date-specific causal attribution
// was found in the report. They are user-requested explanations, NOT an anomaly
// class or a numerical "small area" threshold. Missing observations stay missing.
const EXPLAIN_DATES = new Set(['2004-07', '2020-07']);
const DATE = /^\d{4}-(0[1-9]|1[0-2])$/;
const GENERAL = '月分类检出面积，非单日实测湖面或水位；覆盖达标不等于分类无误，面积差本身不能确定变化原因。';

function eligible(sample) {
  return !!sample && DATE.test(sample.date || '') &&
    sample.quality_qualified === true &&
    Number.isFinite(sample.detected_water_ha) && sample.detected_water_ha >= 0;
}

function description(sample) {
  return `${sample.date.slice(0, 4)}年${Number(sample.date.slice(5))}月 ${sample.detected_water_ha.toFixed(2)}公顷`;
}

/**
 * Accepts a selected shoreline_index.json sample (or null) and its samples array.
 * Returns plain text for textContent, never HTML. Render general once and render
 * dateNote only when nonempty. comparisons contains eligible July neighbors only:
 * [{relation: 'previous'|'next', date, areaHa}]. No input is sorted or mutated.
 */
export function buildShoreObservationNote(currentSample, allSamples = []) {
  if (!eligible(currentSample)) {
    return {general: '本月无可用合格面积；缺测或覆盖不足不作零，也不补造水面。', dateNote: '', comparisons: []};
  }
  let general = GENERAL;
  if (currentSample.detected_water_ha === 0) general += '零检出不等于现场干湖。';
  if (currentSample.classification_disputed === true) general += '本期保留原有分类争议标记。';
  if (!EXPLAIN_DATES.has(currentSample.date)) return {general, dateNote: '', comparisons: []};

  const july = (Array.isArray(allSamples) ? allSamples : [])
    .filter(sample => eligible(sample) && sample.date.endsWith('-07'))
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const previous = july.filter(sample => sample.date < currentSample.date).at(-1);
  const next = july.find(sample => sample.date > currentSample.date);
  const comparisons = [];
  const labels = [];
  if (previous) {
    comparisons.push({relation: 'previous', date: previous.date, areaHa: previous.detected_water_ha});
    labels.push(`前一个${description(previous)}`);
  }
  if (next) {
    comparisons.push({relation: 'next', date: next.date, areaHa: next.detected_water_ha});
    labels.push(`后一个${description(next)}`);
  }
  let dateNote = `当前检出：${description(currentSample)}。`;
  if (labels.length) dateNote += `最近可用的合格7月对照：${labels.join('；')}。这是相邻可用观测，非连续年份序列。`;
  else dateNote += '当前资料未提供其他可用的合格7月对照。';
  dateNote += '原研究未给本期单独的成因归属，不能仅凭面积差认定干湖或推断天气、取水等原因。';
  if (comparisons.some(sample => sample.areaHa === 0)) dateNote += '对照中的零检出也不等于现场干湖。';
  return {general, dateNote, comparisons};
}
