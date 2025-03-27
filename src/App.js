import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import './App.css';

// Helper function to mimic numpy.linspace
function linspace(start, stop, num) {
  const arr = [];
  const step = (stop - start) / (num - 1);
  for (let i = 0; i < num; i++) {
    arr.push(start + step * i);
  }
  return arr;
}

// Function that calculates liquidity parameters
function calculateLiquidity(P_lower, P_upper, P_entry, current_price, initial_eth, P_withdraw) {
  const P_values = linspace(P_lower, P_upper, 100);
  if (Math.sqrt(P_upper) === Math.sqrt(P_entry)) {
    return {
      eth_at_current: 0,
      usdc_at_current: 0,
      P_values,
      eth_holdings: Array(100).fill(0),
      usdc_holdings: Array(100).fill(0),
      v3_position_value: Array(100).fill(0),
      value_of_assets_outside: Array(100).fill(0),
      impermanent_loss: Array(100).fill(0),
      v3_value_at_current: 0,
      impermanent_loss_at_current: 0,
      withdrawn_value: 0,
      withdrawn_il: 0,
      eth_at_withdraw: 0,
      usdc_at_withdraw: 0
    };
  }
  const L = initial_eth * Math.sqrt(P_entry) * Math.sqrt(P_upper) / (Math.sqrt(P_upper) - Math.sqrt(P_entry));
  const eth_holdings = P_values.map(P => L * (Math.sqrt(P_upper) - Math.sqrt(P)) / (Math.sqrt(P) * Math.sqrt(P_upper)));
  const usdc_holdings = P_values.map(P => L * (Math.sqrt(P) - Math.sqrt(P_lower)));

  // Calculate holdings and value at withdrawal price
  const eth_at_withdraw = L * (Math.sqrt(P_upper) - Math.sqrt(P_withdraw)) / (Math.sqrt(P_withdraw) * Math.sqrt(P_upper));
  const usdc_at_withdraw = L * (Math.sqrt(P_withdraw) - Math.sqrt(P_lower));
  const withdrawn_value = eth_at_withdraw * P_withdraw + usdc_at_withdraw;
  const withdrawn_il = Math.abs(withdrawn_value - (initial_eth * P_withdraw));

  // Original calculations
  const eth_at_current = L * (Math.sqrt(P_upper) - Math.sqrt(current_price)) / (Math.sqrt(current_price) * Math.sqrt(P_upper));
  const usdc_at_current = L * (Math.sqrt(current_price) - Math.sqrt(P_lower));
  const v3_position_value = P_values.map((P, i) => eth_holdings[i] * P + usdc_holdings[i]);
  const value_of_assets_outside = P_values.map(P => initial_eth * P);
  const impermanent_loss = v3_position_value.map((v3, i) => Math.abs(v3 - value_of_assets_outside[i]));
  const v3_value_at_current = eth_at_current * current_price + usdc_at_current;
  const impermanent_loss_at_current = Math.abs(v3_value_at_current - (initial_eth * current_price));

  return {
    eth_at_current,
    usdc_at_current,
    P_values,
    eth_holdings,
    usdc_holdings,
    v3_position_value,
    value_of_assets_outside,
    impermanent_loss,
    v3_value_at_current,
    impermanent_loss_at_current,
    withdrawn_value,
    withdrawn_il,
    eth_at_withdraw,
    usdc_at_withdraw
  };
}

function App() {
  // Input state
  const [P_lower, setPLower] = useState(1000);
  const [P_upper, setPUpper] = useState(3000);
  const [P_entry, setPEntry] = useState(1000);
  const [currentPrice, setCurrentPrice] = useState(3000);
  const [initialEth, setInitialEth] = useState(1);
  const [P_withdraw, setPWithdraw] = useState(2000);

  // Computed liquidity state
  const [data, setData] = useState(null);

  // Refs for canvas elements
  const compositionChartRef = useRef(null);
  const v3PositionChartRef = useRef(null);
  const impermanentLossChartRef = useRef(null);
  const withdrawalChartRef = useRef(null);  // Ref for the new chart

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = calculateLiquidity(
      Number(P_lower),
      Number(P_upper),
      Number(P_entry),
      Number(currentPrice),
      Number(initialEth),
      Number(P_withdraw)
    );
    setData(result);
  };

  // Render charts when data is available
  useEffect(() => {
    let compChart, posChart, ilChart, withdrawChart;

    if (data && compositionChartRef.current) {
      const ctx = compositionChartRef.current.getContext('2d');
    
      // Destroy existing chart instance if it exists
      if (compChart) {
        compChart.destroy();
      }
    
      compChart = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'USDC Holdings',
              data: data.P_values.map((p, i) => ({ x: p, y: data.usdc_holdings[i] })),
              borderColor: 'blue',
              fill: false,
              tension: 0.4,
              pointRadius: 0,
              yAxisID: 'yLeft'
            },
            {
              label: 'ETH Holdings',
              data: data.P_values.map((p, i) => ({ x: p, y: data.eth_holdings[i] })),
              borderColor: 'orange',
              fill: false,
              tension: 0.4,
              pointRadius: 0,
              yAxisID: 'yRight'
            },
            {
              label: 'Current USDC Holdings',
              data: [{ x: Number(currentPrice), y: data.usdc_at_current }],
              backgroundColor: 'blue',
              pointRadius: 6,
              type: 'scatter',
              yAxisID: 'yLeft'
            },
            {
              label: 'Current ETH Holdings',
              data: [{ x: Number(currentPrice), y: data.eth_at_current }],
              backgroundColor: 'orange',
              pointRadius: 6,
              type: 'scatter',
              yAxisID: 'yRight'
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            x: {
              type: 'linear',
              title: { display: true, text: 'ETH Price (USDC)' }
            },
            yLeft: {
              type: 'linear',
              position: 'left',
              title: { display: true, text: 'USDC Holdings' },
              ticks: { color: 'blue' }
            },
            yRight: {
              type: 'linear',
              position: 'right',
              title: { display: true, text: 'ETH Holdings' },
              ticks: { color: 'orange' },
              grid: { drawOnChartArea: false } // Avoid overlapping grid lines
            }
          },
          plugins: {
            tooltip: { mode: 'index', intersect: false }
          }
        }
      });
    }

    if (data && v3PositionChartRef.current) {
      const ctx2 = v3PositionChartRef.current.getContext('2d');
      const hodlValue = Number(initialEth) * Number(currentPrice);

      posChart = new Chart(ctx2, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'V3 Position Value',
              data: data.P_values.map((p, i) => ({ x: p, y: data.v3_position_value[i] })),
              borderColor: 'blue',
              fill: false,
              tension: 0.4,
              pointRadius: 0
            },
            {
              label: 'HODL Value',
              data: data.P_values.map((p, i) => ({ x: p, y: data.value_of_assets_outside[i] })),
              borderColor: 'green',
              fill: false,
              tension: 0.4,
              pointRadius: 0
            },
            {
              label: 'Current V3 Value',
              data: [{ x: Number(currentPrice), y: data.v3_value_at_current }],
              backgroundColor: 'blue',
              pointRadius: 6,
              type: 'scatter'
            },
            {
              label: 'Current HODL Value',
              data: [{ x: Number(currentPrice), y: hodlValue }],
              backgroundColor: 'green',
              pointRadius: 6,
              type: 'scatter'
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            x: {
              type: 'linear',
              title: { display: true, text: 'ETH Price (USDC)' }
            },
            y: {
              title: { display: true, text: 'Value (USDC)' }
            }
          },
          plugins: {
            tooltip: { mode: 'index', intersect: false }
          }
        }
      });
    }

    if (data && impermanentLossChartRef.current) {
      const ctx3 = impermanentLossChartRef.current.getContext('2d');
      ilChart = new Chart(ctx3, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Impermanent Loss',
              data: data.P_values.map((p, i) => ({ x: p, y: data.impermanent_loss[i] })),
              borderColor: 'red',
              fill: false,
              tension: 0.4,
              pointRadius: 0
            },
            {
              label: 'Current Impermanent Loss',
              data: [{ x: Number(currentPrice), y: data.impermanent_loss_at_current }],
              backgroundColor: 'red',
              pointRadius: 6,
              type: 'scatter'
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            x: {
              type: 'linear',
              title: { display: true, text: 'ETH Price (USDC)' }
            },
            y: {
              title: { display: true, text: 'Impermanent Loss (USD)' }
            }
          },
          plugins: {
            tooltip: { mode: 'index', intersect: false }
          }
        }
      });
    }
    if (data && withdrawalChartRef.current) {
      const ctx4 = withdrawalChartRef.current.getContext('2d');

      // Calculate the tangent line
      const calculateTangentLine = (P_values, v3_position_value, P_withdraw) => {
        // Find the index closest to the withdrawal price
        const withdrawIndex = P_values.reduce((prev, curr, idx) => 
          Math.abs(curr - P_withdraw) < Math.abs(P_values[prev] - P_withdraw) ? idx : prev, 0);

        // Compute derivative using central difference method
        const h = 0.1; // Small step for numerical derivative
        const leftIndex = Math.max(0, withdrawIndex - 1);
        const rightIndex = Math.min(P_values.length - 1, withdrawIndex + 1);
        
        const derivative = (v3_position_value[rightIndex] - v3_position_value[leftIndex]) / 
                           (P_values[rightIndex] - P_values[leftIndex]);

        // Withdrawal point value
        const withdrawalValue = v3_position_value[withdrawIndex];

        // Generate tangent line points
        const tangentLineData = P_values.map(p => ({
          x: p,
          y: derivative * (p - P_withdraw) + withdrawalValue
        }));

        return { tangentLineData, derivative, withdrawalValue };
      };

      // Calculate tangent line
      const { tangentLineData, derivative, withdrawalValue } = calculateTangentLine(
        data.P_values, 
        data.v3_position_value, 
        Number(P_withdraw)
      );

      const withdrawChart = new Chart(ctx4, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'V3 Position Value (Parabola)',
              data: data.P_values.map((p, i) => ({ x: p, y: data.v3_position_value[i] })),
              borderColor: 'blue',
              backgroundColor: 'rgba(0, 0, 255, 0.1)',
              fill: false,
              tension: 0.4,
              pointRadius: 0
            },
            {
              label: 'Pool Value after withdrawal ',
              data: tangentLineData,
              borderColor: 'red',
              borderDash: [5, 5], // Dashed line to distinguish
              fill: false,
              tension: 0,
              pointRadius: 0
            },
            {
              label: 'Withdrawal Point',
              data: [{ x: Number(P_withdraw), y: withdrawalValue }],
              backgroundColor: 'red',
              pointRadius: 6,
              type: 'scatter'
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            x: {
              type: 'linear',
              title: { display: true, text: 'ETH Price (USDC)' }
            },
            y: {
              title: { display: true, text: 'Value (USDC)' }
            }
          },
          plugins: {
            tooltip: { 
              mode: 'index', 
              intersect: false,
              callbacks: {
                label: function(context) {
                  if (context.dataset.label === 'Value after withdrawal') {
                    return `Slope: ${derivative.toFixed(4)}`;
                  }
                  return context.formattedValue;
                }
              }
            },
            annotation: {
              annotations: {
                tangentInfo: {
                  type: 'label',
                  xValue: Number(P_withdraw),
                  yValue: withdrawalValue,
                  content: `Slope: ${derivative.toFixed(4)}`,
                  font: {
                    size: 12
                  }
                }
              }
            }
          }
        }
      });

      return () => {
        if (compChart) compChart.destroy();
        if (posChart) posChart.destroy();
        if (ilChart) ilChart.destroy();
        if (withdrawChart) withdrawChart.destroy();
      };
    }
  }, [data, currentPrice, initialEth, P_withdraw]);
  // Compute slider percentages
  const ethValueAtCurrent = data ? data.eth_at_current * currentPrice : 0;
  const totalValue = ethValueAtCurrent + (data ? data.usdc_at_current : 0);
  const ethPercentage = totalValue > 0 ? (ethValueAtCurrent / totalValue) * 100 : 50;
  const usdcPercentage = totalValue > 0 ? ((data.usdc_at_current) / totalValue) * 100 : 50;

  return (
    <div className="container">
      <h2>Uniswap V3 Liquidity Analysis</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Lower Price (USDC):</label>
          <input type="number" value={P_lower} onChange={(e) => setPLower(e.target.value)} step="0.01" required />
        </div>

        <div className="input-group">
          <label>Upper Price (USDC):</label>
          <input type="number" value={P_upper} onChange={(e) => setPUpper(e.target.value)} step="0.01" required />
        </div>

        <div className="input-group">
          <label>Entry Price (USDC):</label>
          <input type="number" value={P_entry} onChange={(e) => setPEntry(e.target.value)} step="0.01" required />
        </div>

        <div className="input-group">
          <label>Current Price (USDC):</label>
          <input type="number" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} step="0.01" required />
        </div>

        <div className="input-group">
          <label>Initial ETH:</label>
          <input type="number" value={initialEth} onChange={(e) => setInitialEth(e.target.value)} step="0.01" required />
        </div>

        <div className="input-group">
          <label>Withdrawal Price (USDC):</label>
          <input type="number" value={P_withdraw} onChange={(e) => setPWithdraw(e.target.value)} step="0.01" required />
        </div>

        <button type="submit">Calculate Position</button>
      </form>

      {data && (
        <div className="results">
          <div className="positions-container">
            <div className="position-card">
              <h3>Current Position</h3>
              <p>
                <span>ETH Holdings:</span>
                <span>{data.eth_at_current.toFixed(4)} ETH</span>
              </p>
              <p>
                <span>USDC Holdings:</span>
                <span>{data.usdc_at_current.toFixed(2)} USDC</span>
              </p>
              <p>
                <span>Portfolio Value:</span>
                <span>{data.v3_value_at_current.toFixed(2)} USDC</span>
              </p>
              <p>
                <span>Impermanent Loss:</span>
                <span>{data.impermanent_loss_at_current.toFixed(2)} USDC</span>
              </p>
            </div>
            <div className="position-card">
              <h3>At Withdrawal Price</h3>
              <p>
                <span>ETH:</span>
                <span>{data.eth_at_withdraw?.toFixed(4)} ETH</span>
              </p>
              <p>
                <span>USDC:</span>
                <span>{data.usdc_at_withdraw?.toFixed(2)} USDC</span>
              </p>
              <p>
                <span>Portfolio Value:</span>
                <span>{data.withdrawn_value?.toFixed(2)} USDC</span>
              </p>
              <p>
                <span>Impermanent Loss:</span>
                <span>{data.withdrawn_il?.toFixed(2)} USDC</span>
              </p>
            </div>
          </div>

          <div className="slider-container">
            <label>ETH-USDC Composition:</label>
            <input type="range" min="0" max="100" value={ethPercentage} disabled />
            <span className="slider-percentage">
              ETH: {ethPercentage.toFixed(2)}% | USDC: {usdcPercentage.toFixed(2)}%
            </span>
          </div>

          <div className="chart-container">
            <h3>Liquidity Composition</h3>
            <canvas ref={compositionChartRef}></canvas>
          </div>

          <div className="chart-container">
            <h3>Value of V3 Position vs HODL</h3>
            <canvas ref={v3PositionChartRef}></canvas>
          </div>

          <div className="chart-container">
            <h3>V3 Position Value at Withdrawal</h3>
            <canvas ref={withdrawalChartRef}></canvas>
          </div>

          <div className="chart-container">
            <h3>Impermanent Loss</h3>
            <canvas ref={impermanentLossChartRef}></canvas>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
