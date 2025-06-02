<script>
	export let color = 'white';
	export let size = 12;

	$: calculatedHeight = (size / 12) * 13;
</script>

<svg
	width={size}
	height={calculatedHeight}
	viewBox="0 0 12 13"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
>
	<path
		fill-rule="evenodd"
		clip-rule="evenodd"
		d="M2.07576 4.78783C2.31007 4.55351 2.68997 4.55351 2.92429 4.78783L6.00002 7.86356L9.07576 4.78783C9.31008 4.55351 9.68997 4.55351 9.92429 4.78783C10.1586 5.02214 10.1586 5.40204 9.92429 5.63636L6.42429 9.13636C6.18997 9.37067 5.81008 9.37067 5.57576 9.13636L2.07576 5.63636C1.84145 5.40204 1.84145 5.02214 2.07576 4.78783Z"
		fill={color}
	/>
</svg>
