<script lang="ts">
	interface Props {
		visible: boolean;
		onclick?: () => void;
	}
	const { visible, onclick }: Props = $props();

	function handleClick() {
		if (onclick) {
			onclick();
		}
	}
</script>

<button
	class="reload-prompt"
	class:visible
	onclick={handleClick}
	onkeydown={handleClick}
	inert={!visible}
>
	Reload page to see changes</button
>
