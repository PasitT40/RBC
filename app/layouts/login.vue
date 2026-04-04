<template>
  <div class="login-shell">
    <div class="login-shell__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #f9efe3 0%, #f4c182 100%);
}

.login-shell__content {
  width: 100%;
  max-width: 560px;
}
</style>
