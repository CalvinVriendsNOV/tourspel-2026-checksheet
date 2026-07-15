async function loadResults() {
  if (window.location.protocol === 'file:') {
    throw new Error('Start the dashboard with: make preview-public, then open http://localhost:8000');
  }
  const response = await fetch('data/results.json');
  if (!response.ok) throw new Error('Results are not available yet.');
  const data = await response.json();
  document.querySelector('#updated').textContent = `Updated ${new Date(data.updated_at).toLocaleString()}`;

  const text = value => String(value ?? '—').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const standings = data.standings || [];
  const stagePoints = data.stage_points || [];
  const totalPoints = standings.reduce((sum, row) => sum + Number(row.total_points || 0), 0);
  const completedStages = [...new Set(stagePoints.map(row => row.stage_number))].length;
  document.querySelector('#summary').innerHTML = `
    <article class="stat"><span>Spelers</span><strong>${standings.length}</strong></article>
    <article class="stat"><span>Voltooide etappes</span><strong>${completedStages}</strong></article>
    <article class="stat"><span>Uitgereikte punten</span><strong>${totalPoints}</strong></article>`;
  document.querySelector('#podium').innerHTML = standings.length ? `<div class="podium-card second"><span>2</span><strong>${text(standings[1]?.player_name || '—')}</strong><small>${standings[1]?.total_points || 0} punten</small></div><div class="podium-card first"><span>1</span><strong>${text(standings[0].player_name)}</strong><small>${standings[0].total_points} punten</small></div><div class="podium-card third"><span>3</span><strong>${text(standings[2]?.player_name || '—')}</strong><small>${standings[2]?.total_points || 0} punten</small></div>` : '';
  document.querySelector('#standings').innerHTML = data.standings.map(row => `
    <tr><td>${row.ranking}</td><td class="name">${text(row.player_name)}</td>
    <td>${row.points_1a}</td><td>${row.points_1b}</td><td>${row.points_1c}</td>
    <td>${row.points_1d}</td><td class="total">${row.total_points}</td></tr>`).join('');

  const byStage = {};
  stagePoints.forEach(row => { byStage[row.stage_number] = (byStage[row.stage_number] || 0) + Number(row.total_points || 0); });
  const chartStages = Object.keys(byStage).sort((a, b) => a - b);
  const maxStagePoints = Math.max(...chartStages.map(stage => byStage[stage]), 1);
  document.querySelector('#stage-chart').innerHTML = chartStages.length ? chartStages.map(stage => `<div class="bar-row"><span>Stage ${stage}</span><div class="bar-track"><div class="bar" style="width:${byStage[stage] / maxStagePoints * 100}%"></div></div><strong>${byStage[stage]}</strong></div>`).join('') : '<p class="muted">Stage points will appear after results are published.</p>';
  const cumulative = data.cumulative_points || [];
  const graphStages = [...new Set(cumulative.map(row => Number(row.stage_number)))].sort((a, b) => a - b);
  const graphPlayers = [...new Set(cumulative.map(row => row.player_name))].sort((a, b) => {
    const finalA = Math.max(...cumulative.filter(row => row.player_name === a).map(row => Number(row.cumulative_total_points || 0)), 0);
    const finalB = Math.max(...cumulative.filter(row => row.player_name === b).map(row => Number(row.cumulative_total_points || 0)), 0);
    return finalB - finalA;
  }).slice(0, 8);
  const graphWidth = 900, graphHeight = 390, left = 54, right = 20, top = 24, bottom = 48;
  const graphMax = Math.max(...cumulative.map(row => Number(row.cumulative_total_points || 0)), 1);
  const x = stage => left + (graphStages.length > 1 ? (stage - graphStages[0]) / (graphStages.at(-1) - graphStages[0]) : .5) * (graphWidth - left - right);
  const y = points => graphHeight - bottom - Number(points || 0) / graphMax * (graphHeight - top - bottom);
  const colors = ['#8da9ff', '#b084ff', '#57d6c0', '#ff9d6c', '#f276a8', '#d9e46b', '#6fd3ff', '#ffcf70'];
  const lines = graphPlayers.map((player, index) => {
    const rows = cumulative.filter(row => row.player_name === player).sort((a, b) => a.stage_number - b.stage_number);
    const points = rows.map(row => `${x(Number(row.stage_number)).toFixed(1)},${y(row.cumulative_total_points).toFixed(1)}`).join(' ');
    const dots = rows.map(row => `<circle class="graph-point" cx="${x(Number(row.stage_number)).toFixed(1)}" cy="${y(row.cumulative_total_points).toFixed(1)}" r="5" fill="${colors[index % colors.length]}" data-player="${text(player)}" data-stage="${row.stage_number}" data-points="${row.cumulative_total_points}"/>`).join('');
    return `<g class="graph-series" data-player="${text(player)}"><polyline points="${points}" fill="none" stroke="${colors[index % colors.length]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}</g>`;
  }).join('');
  const grid = Array.from({length: 5}, (_, index) => {
    const value = Math.round(graphMax * index / 4);
    const lineY = y(value);
    return `<line class="grid-line" x1="${left}" y1="${lineY}" x2="${graphWidth - right}" y2="${lineY}"/><text class="y-label" x="${left - 8}" y="${lineY + 4}" text-anchor="end">${value}</text>`;
  }).join('');
  const labels = graphStages.map(stage => `<text x="${x(stage)}" y="${graphHeight - 15}" text-anchor="middle">${stage}</text>`).join('');
  const legend = graphPlayers.map((player, index) => `<button class="legend-item" data-player="${text(player)}"><i style="background:${colors[index % colors.length]}"></i>${text(player)}</button>`).join('');
  document.querySelector('#progression-chart').innerHTML = graphStages.length ? `<p class="chart-note">Top 8 spelers op basis van de huidige stand</p><div class="graph-wrap"><svg class="line-graph" viewBox="0 0 ${graphWidth} ${graphHeight}" role="img" aria-label="Cumulative points progression">${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${graphHeight - bottom}"/><line class="axis" x1="${left}" y1="${graphHeight - bottom}" x2="${graphWidth - right}" y2="${graphHeight - bottom}"/><line class="hover-line" x1="0" y1="${top}" x2="0" y2="${graphHeight - bottom}"/>${lines}${labels}</svg><div class="graph-tooltip" role="status"></div></div><div class="legend">${legend}</div>` : '<p class="muted">The progression graph will appear after results are published.</p>';
  if (graphStages.length) {
    const chart = document.querySelector('#progression-chart');
    const tooltip = chart.querySelector('.graph-tooltip');
    const hoverLine = chart.querySelector('.hover-line');
    chart.querySelectorAll('.graph-point').forEach(point => {
      point.addEventListener('mouseenter', () => {
        tooltip.innerHTML = `<strong>${point.dataset.player}</strong><br>Etappe ${point.dataset.stage}: ${point.dataset.points} punten`;
        tooltip.classList.add('visible');
        tooltip.style.left = `${Number(point.getAttribute('cx')) / graphWidth * 100}%`;
        tooltip.style.top = `${Number(point.getAttribute('cy')) / graphHeight * 100}%`;
        hoverLine.setAttribute('x1', point.getAttribute('cx'));
        hoverLine.setAttribute('x2', point.getAttribute('cx'));
        hoverLine.classList.add('visible');
      });
      point.addEventListener('mouseleave', () => { tooltip.classList.remove('visible'); hoverLine.classList.remove('visible'); });
    });
    chart.querySelectorAll('.legend-item').forEach(item => item.addEventListener('click', () => {
      const series = chart.querySelector(`.graph-series[data-player="${CSS.escape(item.dataset.player)}"]`);
      const hidden = series.classList.toggle('hidden');
      item.classList.toggle('inactive', hidden);
    }));
  }
  const stageResults = data.stage_results || [];
  const stagesWithResults = new Set(stageResults.filter(row => row.result_type === 'stage').map(row => row.stage_number));
  const publicPredictions = (data.predictions || []).filter(row => row.prediction_type !== 'stage' || stagesWithResults.has(row.stage_number));
  const players = [...new Set(publicPredictions.map(row => row.player_name))].sort();
  const predictionCounts = data.prediction_counts || [];
  const stages = [...new Set([...stagePoints.map(row => row.stage_number), ...stageResults.map(row => row.stage_number)])].sort((a, b) => a - b);
  const playerSelect = document.querySelector('#player-select');
  const stageSelect = document.querySelector('#stage-select');
  players.forEach(player => playerSelect.add(new Option(player, player)));
  stages.forEach(stage => stageSelect.add(new Option(`Stage ${stage}`, stage)));

  const renderPlayer = player => {
    if (!player) { document.querySelector('#player-view').innerHTML = ''; return; }
    const predictions = publicPredictions.filter(row => row.player_name === player && row.prediction_type === 'stage');
    const scores = stagePoints.filter(row => row.player_name === player);
    const total = scores.reduce((sum, row) => sum + Number(row.total_points || 0), 0);
    const categories = scores.reduce((result, row) => { ['points_1a', 'points_1b', 'points_1c', 'points_1d'].forEach(key => result[key] += Number(row[key] || 0)); return result; }, {points_1a: 0, points_1b: 0, points_1c: 0, points_1d: 0});
    const counts = predictionCounts.filter(row => row.player_name === player);
    const maxCount = Math.max(...counts.map(row => Number(row.times_predicted)), 5);
    const countView = counts.length ? `<div class="prediction-counts"><div class="count-header"><strong>Voorspellingsfrequentie</strong><span>Maximum: 5 keer per renner</span></div>${counts.map(row => `<div class="count-row ${row.exceeds_maximum ? 'over-limit' : ''}"><span>${text(row.rider_name || `Rider ${row.rider_number}`)}</span><div class="bar-track"><div class="bar" style="width:${Number(row.times_predicted) / maxCount * 100}%"></div></div><strong>${row.times_predicted}×</strong></div>`).join('')}</div>` : '<p class="muted">Geen voorspellingen gevonden.</p>';
    document.querySelector('#player-view').innerHTML = `<article class="card detail"><div class="detail-heading"><h3>${text(player)}'s voorspelling en scores</h3><span class="score-pill">${total} points</span></div><div class="mini-bars">${Object.entries(categories).map(([key, value]) => `<div><span>${key.replace('points_', '').toUpperCase()}</span><div class="bar-track"><div class="bar" style="width:${total ? value / total * 100 : 0}%"></div></div><strong>${value}</strong></div>`).join('')}</div>${countView}<div class="detail-table-scroll"><table class="detail-score-table"><thead><tr><th>Etappe</th><th>Voorspelling</th><th>1A</th><th>1B</th><th>1C</th><th>1D</th><th>Totaal</th></tr></thead><tbody>${predictions.map(row => {
      const score = scores.find(item => item.stage_number === row.stage_number);
      const names = [row.first_place_name || row.first_place, row.second_place_name || row.second_place, row.third_place_name || row.third_place].map(text).join(' · ');
      return `<tr><td>${row.stage_number}</td><td>${names}</td><td>${score ? score.points_1a : '—'}</td><td>${score ? score.points_1b : '—'}</td><td>${score ? score.points_1c : '—'}</td><td>${score ? score.points_1d : '—'}</td><td class="total">${score ? score.total_points : '—'}</td></tr>`;
    }).join('')}</tbody></table></div></article>`;
  };
  const renderStage = stage => {
    if (!stage) { document.querySelector('#stage-view').innerHTML = ''; return; }
    const scores = data.stage_points.filter(row => row.stage_number == stage);
    const actual = stageResults.filter(row => row.stage_number == stage);
    const list = type => actual.filter(row => row.result_type === type).map(row => `<li><span>${text(row.rider_name)}</span></li>`).join('');
    document.querySelector('#stage-view').innerHTML = `<div class="stage-grid"><article class="stage"><h3>Stage ${stage} scoreboard</h3><ol>${scores.map(row => `<li><span>${text(row.player_name)}</span><strong>${row.total_points}</strong></li>`).join('')}</ol></article><article class="stage"><h3>Actual stage result</h3><ol>${list('stage')}</ol><h3>General classification</h3><ol>${list('gc')}</ol></article></div>`;
  };
  playerSelect.addEventListener('change', event => renderPlayer(event.target.value));
  stageSelect.addEventListener('change', event => renderStage(event.target.value));
}
loadResults().catch(error => { document.querySelector('#updated').textContent = error.message; });
