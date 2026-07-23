import { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminOverview,
  fetchOptions,
  fetchRecommendations,
  fetchReport,
  type AdminOverview,
  type OptionsApiResponse,
} from './api';
import { defaultCandidateInput } from './data';
import {
  applyRecommendationView,
  getRiskOrderValue,
  validateCandidateInput,
} from './recommendation';
import type {
  CandidateInput,
  Recommendation,
  RecommendationFilters,
  ReportDraft,
  RiskBand,
  RiskPreference,
  SortBy,
} from './types';

const riskBands: RiskBand[] = ['冲', '稳', '保', '兜底'];
const fallbackCityOptions = ['杭州', '南京', '宁波', '西安', '嘉兴'];
const fallbackTierOptions = ['985', '211', '双一流', '省重点', '普通本科'];
const fallbackMajorOptions = ['计算机', '人工智能', '软件工程', '网络空间安全', '数据科学'];
const fallbackProvinceOptions = ['浙江', '江苏', '上海', '广东'];
const fallbackTrackOptions = ['物理类', '历史类', '物化生', '物化地'];

const initialFilters: RecommendationFilters = {
  riskBands: [],
  cities: [],
  maxTuition: 7000,
  publicOnly: true,
  doubleFirstClassOnly: false,
};

function App() {
  const [input, setInput] = useState<CandidateInput>(defaultCandidateInput);
  // 已生成推荐时所用的输入快照，报告据此刷新，避免随表单逐字符变化而反复请求。
  const [submittedInput, setSubmittedInput] = useState<CandidateInput>(defaultCandidateInput);
  const [filters, setFilters] = useState<RecommendationFilters>(initialFilters);
  const [sortBy, setSortBy] = useState<SortBy>('risk');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [report, setReport] = useState<ReportDraft>(() => createEmptyReport(defaultCandidateInput));
  const [options, setOptions] = useState<OptionsApiResponse | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiBusy, setApiBusy] = useState(false);

  const validationMessages = useMemo(() => validateCandidateInput(input), [input]);
  const blockingMessages = validationMessages.filter((message) => message !== '建议补充全省位次，系统将优先使用位次进行推荐。');
  const visibleRecommendations = useMemo(
    () => applyRecommendationView(recommendations, { filters, sortBy }),
    [recommendations, filters, sortBy],
  );
  const comparedRecommendations = recommendations.filter((item) => compareIds.includes(item.id));
  const activeDetail =
    visibleRecommendations.find((item) => item.id === activeDetailId) ??
    recommendations.find((item) => item.id === activeDetailId) ??
    visibleRecommendations[0] ??
    recommendations[0];
  const cityOptions = options?.cities.length ? options.cities : fallbackCityOptions;
  const tierOptions = options?.tiers.length ? options.tiers : fallbackTierOptions;
  const majorOptions = options?.majors.length ? normalizeMajorOptions(options.majors) : fallbackMajorOptions;
  const provinceOptions = options?.provinces.length ? options.provinces : fallbackProvinceOptions;
  const trackOptions = options?.tracks.length ? options.tracks : fallbackTrackOptions;

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!recommendations.length) {
      setReport(createEmptyReport(submittedInput));
      return;
    }
    void refreshReport(submittedInput, compareIds);
  }, [compareIds, submittedInput, recommendations.length]);

  async function loadInitialData() {
    setApiBusy(true);
    setApiError(null);
    try {
      const [nextOptions, nextOverview, nextRecommendations] = await Promise.all([
        fetchOptions(),
        fetchAdminOverview(),
        fetchRecommendations(input),
      ]);
      setOptions(nextOptions);
      setAdminOverview(nextOverview);
      setRecommendations(nextRecommendations.recommendations);
      setActiveDetailId(nextRecommendations.recommendations[0]?.id ?? null);
      setSubmittedInput(input);
    } catch (error) {
      setApiError(getErrorMessage(error));
    } finally {
      setApiBusy(false);
    }
  }

  async function refreshRecommendations(nextInput: CandidateInput) {
    setApiBusy(true);
    setApiError(null);
    try {
      const response = await fetchRecommendations(nextInput);
      setRecommendations(response.recommendations);
      setActiveDetailId(response.recommendations[0]?.id ?? null);
      setCompareIds((current) =>
        current.filter((id) => response.recommendations.some((item) => item.id === id)),
      );
      setSubmittedInput(nextInput);
    } catch (error) {
      setApiError(getErrorMessage(error));
      setRecommendations([]);
      setReport(createEmptyReport(nextInput));
    } finally {
      setApiBusy(false);
    }
  }

  async function refreshReport(nextInput: CandidateInput, candidateIds: string[]) {
    try {
      setReport(await fetchReport(nextInput, candidateIds));
    } catch (error) {
      setApiError(getErrorMessage(error));
    }
  }

  function updateInput<K extends keyof CandidateInput>(key: K, value: CandidateInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function toggleArrayValue<K extends 'preferredCities' | 'preferredTiers'>(
    key: K,
    value: string,
  ) {
    setInput((current) => {
      const values = current[key];
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }

  function toggleFilterValue<K extends 'riskBands' | 'cities'>(
    key: K,
    value: RecommendationFilters[K][number],
  ) {
    setFilters((current) => {
      const values = current[key];
      return {
        ...current,
        [key]: values.includes(value as never)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }

  function toggleCompare(id: string) {
    setCompareIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].slice(-4),
    );
  }

  function toggleSaved(id: string) {
    setSavedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function submitForm() {
    setHasSubmitted(true);
    if (!blockingMessages.length) {
      void refreshRecommendations(input);
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#input" aria-label="高考志愿推荐首页">
          <span className="brand-mark">志</span>
          <span>
            <strong>高考志愿推荐</strong>
            <small>本地规则引擎 MVP</small>
          </span>
        </a>
        <nav className="nav-links" aria-label="主导航">
          <a href="#input">输入测算</a>
          <a href="#results">推荐结果</a>
          <a href="#compare">院校对比</a>
          <a href="#report">报告预览</a>
        </nav>
        <button className="ghost-button" type="button" onClick={() => window.print()}>
          <ExportIcon />
          导出 PDF
        </button>
      </header>

      <section className="status-band">
        <div>
          <h1>高考志愿推荐工作台</h1>
          <p>输入位次和偏好后生成冲稳保兜底建议；结果仅作辅助参考，以官方最新发布为准。</p>
        </div>
        <div className="trust-row">
          <span>位次优先</span>
          <span>风险分档</span>
          <span>来源留痕</span>
          <span>报告预览</span>
        </div>
      </section>

      <section className="workspace" id="results">
        <div className="left-rail">
        <InputPanel
          input={input}
          provinceOptions={provinceOptions}
          trackOptions={trackOptions}
          cityOptions={cityOptions}
          tierOptions={tierOptions}
          majorOptions={majorOptions}
          validationMessages={hasSubmitted ? validationMessages : []}
          onInputChange={updateInput}
          onTogglePreference={toggleArrayValue}
          onSubmit={submitForm}
          busy={apiBusy}
        />
          <aside className="filter-rail" aria-label="筛选与排序">
            <div className="section-heading">
              <p>筛选排序</p>
              <h2>结果控制</h2>
            </div>

            <fieldset>
              <legend>风险档位</legend>
              <div className="chip-grid">
                {riskBands.map((band) => (
                  <button
                    className={`filter-chip ${filters.riskBands.includes(band) ? 'selected' : ''}`}
                    key={band}
                    type="button"
                    onClick={() => toggleFilterValue('riskBands', band)}
                  >
                    {band}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>城市</legend>
              <div className="chip-grid">
                {cityOptions.map((city) => (
                  <button
                    className={`filter-chip ${filters.cities.includes(city) ? 'selected' : ''}`}
                    key={city}
                    type="button"
                    onClick={() => toggleFilterValue('cities', city)}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="range-field">
              <span>最高学费：{filters.maxTuition?.toLocaleString('zh-CN')} 元/年</span>
              <input
                type="range"
                min="5000"
                max="70000"
                step="1000"
                value={filters.maxTuition}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    maxTuition: Number(event.target.value),
                  }))
                }
              />
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={filters.publicOnly}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, publicOnly: event.target.checked }))
                }
              />
              仅看公办
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={filters.doubleFirstClassOnly}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    doubleFirstClassOnly: event.target.checked,
                  }))
                }
              />
              仅看双一流
            </label>

            <label className="field">
              <span>排序方式</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
                <option value="risk">录取风险</option>
                <option value="match">推荐匹配度</option>
                <option value="tier">院校层次</option>
                <option value="city">城市偏好</option>
                <option value="major">专业匹配度</option>
                <option value="tuition">学费</option>
              </select>
            </label>
          </aside>
        </div>

        <div className="result-list">
          {apiError && (
            <div className="api-alert" role="alert">
              后端 API 暂不可用：{apiError}
            </div>
          )}
          <div className="result-summary">
            <div>
              <span className="summary-label">当前候选</span>
              <strong>{visibleRecommendations.length}</strong>
            </div>
            <div>
              <span className="summary-label">平均匹配</span>
              <strong>{report.summary.averageMatch}</strong>
            </div>
            <div>
              <span className="summary-label">已加入对比</span>
              <strong>{compareIds.length}</strong>
            </div>
          </div>

          {visibleRecommendations.length ? (
            visibleRecommendations.map((recommendation) => (
              <RecommendationRow
                key={recommendation.id}
                recommendation={recommendation}
                compared={compareIds.includes(recommendation.id)}
                saved={savedIds.includes(recommendation.id)}
                onCompare={() => toggleCompare(recommendation.id)}
                onSave={() => toggleSaved(recommendation.id)}
                onDetail={() => setActiveDetailId(recommendation.id)}
              />
            ))
          ) : (
            <div className="empty-state">
              <strong>没有匹配结果</strong>
              <span>尝试放宽城市、风险档位或学费筛选。</span>
            </div>
          )}
        </div>

        <aside className="insight-rail">
          <DetailPanel recommendation={activeDetail} />
          <DataPreview overview={adminOverview} />
        </aside>
      </section>

      <section className="compare-report-grid">
        <ComparisonPanel
          comparedRecommendations={comparedRecommendations}
          onRemove={toggleCompare}
        />
        <ReportPanel
          report={report}
          comparedCount={comparedRecommendations.length}
          onPrint={() => window.print()}
        />
      </section>
    </main>
  );
}

interface InputPanelProps {
  input: CandidateInput;
  provinceOptions: string[];
  trackOptions: string[];
  cityOptions: string[];
  tierOptions: string[];
  majorOptions: string[];
  validationMessages: string[];
  onInputChange: <K extends keyof CandidateInput>(key: K, value: CandidateInput[K]) => void;
  onTogglePreference: <K extends 'preferredCities' | 'preferredTiers'>(key: K, value: string) => void;
  onSubmit: () => void;
  busy: boolean;
}

function InputPanel({
  input,
  provinceOptions,
  trackOptions,
  cityOptions,
  tierOptions,
  majorOptions,
  validationMessages,
  onInputChange,
  onTogglePreference,
  onSubmit,
  busy,
}: InputPanelProps) {
  return (
    <form className="input-panel" id="input" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <div className="panel-title">
        <span>输入测算条件</span>
        <strong>2026 志愿测算</strong>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>生源省份</span>
          <select value={input.province} onChange={(event) => onInputChange('province', event.target.value)}>
            {provinceOptions.map((province) => (
              <option value={province} key={province}>{province}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>年份</span>
          <input
            type="number"
            value={input.year}
            onChange={(event) => onInputChange('year', Number(event.target.value))}
          />
        </label>

        <label className="field">
          <span>科类/选科</span>
          <select value={input.track} onChange={(event) => onInputChange('track', event.target.value)}>
            {trackOptions.map((track) => (
              <option value={track} key={track}>{track}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>高考分数</span>
          <input
            type="number"
            value={input.score ?? ''}
            onChange={(event) =>
              onInputChange('score', event.target.value ? Number(event.target.value) : undefined)
            }
          />
        </label>

        <label className="field emphasized-field">
          <span>全省位次</span>
          <input
            type="number"
            value={input.rank ?? ''}
            onChange={(event) =>
              onInputChange('rank', event.target.value ? Number(event.target.value) : undefined)
            }
          />
        </label>

        <label className="field">
          <span>批次线</span>
          <input
            type="number"
            value={input.batchLine ?? ''}
            onChange={(event) =>
              onInputChange('batchLine', event.target.value ? Number(event.target.value) : undefined)
            }
          />
        </label>

        <label className="field wide-field">
          <span>目标专业</span>
          <select
            value={input.targetMajor}
            onChange={(event) => onInputChange('targetMajor', event.target.value)}
          >
            {majorOptions.map((major) => (
              <option value={major} key={major}>{major}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>风险偏好</span>
          <select
            value={input.riskPreference}
            onChange={(event) => onInputChange('riskPreference', event.target.value as RiskPreference)}
          >
            <option value="aggressive">更积极</option>
            <option value="balanced">均衡</option>
            <option value="conservative">更保守</option>
          </select>
        </label>
      </div>

      <div className="preference-block">
        <span>城市偏好</span>
        <div className="chip-grid">
          {cityOptions.map((city) => (
            <button
              className={`filter-chip ${input.preferredCities.includes(city) ? 'selected' : ''}`}
              type="button"
              key={city}
              onClick={() => onTogglePreference('preferredCities', city)}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      <div className="preference-block">
        <span>院校层次偏好</span>
        <div className="chip-grid">
          {tierOptions.map((tier) => (
            <button
              className={`filter-chip ${input.preferredTiers.includes(tier) ? 'selected' : ''}`}
              type="button"
              key={tier}
              onClick={() => onTogglePreference('preferredTiers', tier)}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      <div className="toggle-grid">
        <label className="switch-row">
          <input
            type="checkbox"
            checked={input.acceptsAdjustment}
            onChange={(event) => onInputChange('acceptsAdjustment', event.target.checked)}
          />
          接受专业调剂
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={input.specialTypes.sinoForeign}
            onChange={(event) =>
              onInputChange('specialTypes', {
                ...input.specialTypes,
                sinoForeign: event.target.checked,
              })
            }
          />
          考虑中外合作
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={input.specialTypes.localPlan}
            onChange={(event) =>
              onInputChange('specialTypes', {
                ...input.specialTypes,
                localPlan: event.target.checked,
              })
            }
          />
          地方专项
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={input.specialTypes.earlyBatch}
            onChange={(event) =>
              onInputChange('specialTypes', {
                ...input.specialTypes,
                earlyBatch: event.target.checked,
              })
            }
          />
          提前批
        </label>
      </div>

      {validationMessages.length > 0 && (
        <div className="validation-box" role="status">
          {validationMessages.map((message) => (
            <span key={message}>{message}</span>
          ))}
        </div>
      )}

      <button className="primary-button" type="submit" disabled={busy}>
        <SearchIcon />
        {busy ? '正在生成' : '生成推荐'}
      </button>
    </form>
  );
}

interface RecommendationRowProps {
  recommendation: Recommendation;
  compared: boolean;
  saved: boolean;
  onCompare: () => void;
  onSave: () => void;
  onDetail: () => void;
}

function RecommendationRow({
  recommendation,
  compared,
  saved,
  onCompare,
  onSave,
  onDetail,
}: RecommendationRowProps) {
  return (
    <article className="recommendation-row">
      <div className="risk-column">
        <span className={`risk-badge risk-${getRiskOrderValue(recommendation.riskBand)}`}>
          {recommendation.riskBand}
        </span>
        <strong>{recommendation.matchScore}</strong>
        <small>匹配度</small>
      </div>

      <div className="candidate-main">
        <div className="candidate-title">
          <div>
            <h3>{recommendation.university}</h3>
            <p>{recommendation.major}</p>
          </div>
          <button className="icon-button" type="button" onClick={onSave} aria-label="收藏院校专业">
            <StarIcon filled={saved} />
          </button>
        </div>
        <div className="fact-grid">
          <span>{recommendation.city}</span>
          <span>{recommendation.tier}</span>
          <span>近三年位次 {Math.round(recommendation.averageMinRank).toLocaleString('zh-CN')}</span>
          {recommendation.equivalentScore != null && (
            <span>等效分≈{recommendation.equivalentScore}</span>
          )}
          <span>计划 {recommendation.plan2026} 人</span>
          <span>{recommendation.subjectRequirement}</span>
          <span>{recommendation.tuition.toLocaleString('zh-CN')} 元/年</span>
        </div>
        <p className="reason-text">{recommendation.reason}</p>
        <p className="source-text">数据来源：{recommendation.source}；更新时间：{recommendation.updatedAt}</p>
      </div>

      <div className="row-actions">
        <button className="ghost-button compact" type="button" onClick={onDetail}>
          查看详情
        </button>
        <button
          className={`secondary-button compact ${compared ? 'selected' : ''}`}
          type="button"
          onClick={onCompare}
        >
          {compared ? '移出对比' : '加入对比'}
        </button>
      </div>
    </article>
  );
}

function DetailPanel({ recommendation }: { recommendation?: Recommendation }) {
  if (!recommendation) {
    return (
      <section className="side-panel">
        <h2>院校详情</h2>
        <p>暂无可展示的候选项。</p>
      </section>
    );
  }

  return (
    <section className="side-panel">
      <div className="section-heading">
        <p>院校详情</p>
        <h2>{recommendation.university}</h2>
      </div>
      <dl className="detail-list">
        <div>
          <dt>所在地</dt>
          <dd>{recommendation.city}</dd>
        </div>
        <div>
          <dt>办学层次</dt>
          <dd>{recommendation.tier}</dd>
        </div>
        <div>
          <dt>院校类型</dt>
          <dd>{recommendation.publicSchool ? '公办本科' : '民办本科'}</dd>
        </div>
        <div>
          <dt>重点专业</dt>
          <dd>{recommendation.category}</dd>
        </div>
        <div>
          <dt>近三年等效分</dt>
          <dd>
            {recommendation.equivalentScore != null
              ? `约 ${recommendation.equivalentScore} 分（历年录取位次折合今年）`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>限制条件</dt>
          <dd>{recommendation.restrictions.length ? recommendation.restrictions.join('、') : '暂无特殊限制'}</dd>
        </div>
      </dl>
      <p className="risk-note">{recommendation.riskNote}</p>
    </section>
  );
}

function DataPreview({ overview }: { overview: AdminOverview | null }) {
  const versionName = overview?.dataVersion?.name ?? '等待后端数据';
  const recordCount = overview?.tables.admissionRecords ?? 0;
  const ruleStrategy = overview?.ruleConfig?.strategy === 'rank-first' ? '位次优先' : '未加载';
  const latestImport = overview?.recentImports[0]?.message ?? '暂无导入日志';

  return (
    <section className="side-panel data-panel">
      <div className="section-heading">
        <p>数据管理预览</p>
        <h2>后台能力</h2>
      </div>
      <div className="data-row">
        <span>招生计划版本</span>
        <strong>{versionName}</strong>
      </div>
      <div className="data-row">
        <span>历年录取数据</span>
        <strong>{recordCount} 条样例</strong>
      </div>
      <div className="data-row">
        <span>一分一段表</span>
        <strong>{overview?.tables.scoreSegments ?? 0} 行</strong>
      </div>
      <div className="data-row">
        <span>规则配置</span>
        <strong>{ruleStrategy}</strong>
      </div>
      <div className="data-row">
        <span>操作日志</span>
        <strong>{latestImport}</strong>
      </div>
    </section>
  );
}

function ComparisonPanel({
  comparedRecommendations,
  onRemove,
}: {
  comparedRecommendations: Recommendation[];
  onRemove: (id: string) => void;
}) {
  return (
    <section className="comparison-panel" id="compare">
      <div className="section-heading">
        <p>院校专业对比</p>
        <h2>候选清单</h2>
      </div>
      {comparedRecommendations.length ? (
        <div className="comparison-table-wrap">
          <table>
            <thead>
              <tr>
                <th>院校</th>
                <th>专业</th>
                <th>城市</th>
                <th>层次</th>
                <th>历年最低位次</th>
                <th>计划</th>
                <th>学费</th>
                <th>风险</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {comparedRecommendations.map((item) => (
                <tr key={item.id}>
                  <td>{item.university}</td>
                  <td>{item.major}</td>
                  <td>{item.city}</td>
                  <td>{item.tier}</td>
                  <td>{Math.round(item.averageMinRank).toLocaleString('zh-CN')}</td>
                  <td>{item.plan2026}</td>
                  <td>{item.tuition.toLocaleString('zh-CN')}</td>
                  <td>{item.riskBand}</td>
                  <td>
                    <button className="text-button" type="button" onClick={() => onRemove(item.id)}>
                      移除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state small">
          <strong>尚未加入对比</strong>
          <span>在推荐结果中选择“加入对比”。</span>
        </div>
      )}
    </section>
  );
}

function ReportPanel({
  report,
  comparedCount,
  onPrint,
}: {
  report: ReportDraft;
  comparedCount: number;
  onPrint: () => void;
}) {
  return (
    <section className="report-panel" id="report">
      <div className="section-heading">
        <p>志愿报告预览</p>
        <h2>{comparedCount ? '对比项报告' : '全量推荐报告'}</h2>
      </div>
      <div className="report-summary">
        {riskBands.map((band) => (
          <div key={band}>
            <span>{band}</span>
            <strong>{report.summary.byBand[band]}</strong>
          </div>
        ))}
      </div>
      <div className="report-body">
        <p>
          输入条件：{report.inputSnapshot.province} / {report.inputSnapshot.track} /
          {report.inputSnapshot.rank ? ` 位次 ${report.inputSnapshot.rank.toLocaleString('zh-CN')}` : ' 未填位次'} /
          目标专业 {report.inputSnapshot.targetMajor}
        </p>
        <ul>
          {report.riskWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
        <p className="source-text">数据来源：{report.dataSources.join('；') || '暂无'}</p>
        <p className="disclaimer">{report.disclaimer}</p>
      </div>
      <button className="primary-button" type="button" onClick={onPrint}>
        <ExportIcon />
        打印 / 保存 PDF
      </button>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="button-icon">
      <path d="M10.8 18.1a7.3 7.3 0 1 1 0-14.6 7.3 7.3 0 0 1 0 14.6Zm0-2a5.3 5.3 0 1 0 0-10.6 5.3 5.3 0 0 0 0 10.6Zm5.1.2 4.1 4.1-1.5 1.4-4.1-4.1 1.5-1.4Z" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="button-icon">
      <path d="M12 3a1 1 0 0 1 1 1v8.6l2.7-2.7 1.4 1.4-5.1 5.1-5.1-5.1 1.4-1.4 2.7 2.7V4a1 1 0 0 1 1-1ZM5 17h2v2h10v-2h2v3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-3Z" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="star-icon">
      <path
        d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

function createEmptyReport(input: CandidateInput): ReportDraft {
  return {
    inputSnapshot: input,
    summary: {
      total: 0,
      byBand: { 冲: 0, 稳: 0, 保: 0, 兜底: 0 },
      averageMatch: 0,
    },
    candidates: [],
    riskWarnings: ['后端 API 尚未返回报告数据。'],
    dataSources: [],
    disclaimer:
      '本报告为高考志愿辅助决策参考，不构成录取承诺，不替代各省教育考试院、教育部阳光高考平台及高校官方信息。',
  };
}

function normalizeMajorOptions(values: string[]) {
  const normalized = new Set(fallbackMajorOptions);
  for (const value of values) {
    normalized.add(value.replace(/类$/, ''));
    normalized.add(value);
  }
  return Array.from(normalized);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误';
}

export default App;
