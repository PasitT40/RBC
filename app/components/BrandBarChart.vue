<script setup lang="ts">
import * as echarts from "echarts";

type BrandPoint = {
  label: string;
  qty: number;
  amount: number;
};

const props = withDefaults(
  defineProps<{
    data: BrandPoint[];
    height?: number;
    metric?: "qty" | "amount";
  }>(),
  {
    height: 280,
    metric: "qty",
  }
);

const chartEl = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;

const renderChart = () => {
  if (!chart) return;

  const labels = props.data.map((item) => item.label);
  const seriesValues = props.data.map((item) => props.metric === "amount" ? item.amount : item.qty);
  const palette = ["#93b7f3", "#5fd7c9", "#0b0b0b", "#67aaf9", "#a784e8", "#65d98c", "#f5b45b", "#ff8d7a"];

  chart.setOption({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any) => {
        const point = props.data[params[0]?.dataIndex ?? 0];
        if (!point) return "";
        return [
          `<strong>${point.label}</strong>`,
          `จำนวน: ${point.qty.toLocaleString()} ชิ้น`,
          `ยอดขาย: ฿${point.amount.toLocaleString()}`,
        ].join("<br/>");
      },
    },
    grid: { left: 16, right: 16, top: 24, bottom: 24, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#d7dce3" } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#edf1f5" } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: props.metric === "amount"
        ? {
            formatter: (value: number) => {
              if (value >= 1000) return `${Math.round(value / 1000)}K`;
              return String(value);
            },
          }
        : undefined,
    },
    series: [
      {
        type: "bar",
        data: seriesValues,
        barWidth: 24,
        itemStyle: {
          borderRadius: [10, 10, 0, 0],
          color: (params: { dataIndex: number }) => palette[params.dataIndex % palette.length],
        },
      },
    ],
  });
};

const onResize = () => chart?.resize();

onMounted(() => {
  if (!chartEl.value) return;
  chart = echarts.init(chartEl.value);
  renderChart();
  window.addEventListener("resize", onResize);
});

watch(
  () => [props.data, props.metric],
  () => {
    renderChart();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="chartEl" :style="{ width: '100%', height: `${height}px` }" />
</template>
