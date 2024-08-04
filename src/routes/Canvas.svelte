<script lang="ts">
</script>

<main>
	<div id="canvas-container">
		<canvas id="grid-canvas" width="1920" height="1080"></canvas>
		<canvas id="animation-canvas" width="1920" height="1080"></canvas>
		<canvas id="selection-canvas" width="1920" height="1080"></canvas>
	</div>
</main>

<style>
	#canvas-container {
		position: relative;
		width: 100vw;
		height: 100vh;
	}
	canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}
</style>
