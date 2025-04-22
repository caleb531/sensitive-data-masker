<script>
	const props = $props();
</script>

<label class="switch-container">
	<!-- Make sure that the "switch-input" class is still applied even if other
	classes are added via props -->
	<input type="checkbox" {...props} class:switch-input={true} />
	<div class="switch-track">
		<div class="switch-thumb"></div>
	</div>
</label>
