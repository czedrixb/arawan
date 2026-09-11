<template>
  <div class="flex min-h-dvh bg-canvas">
    <AppSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <TopProgress />
      <main class="flex-1 pb-24 lg:pb-8">
        <slot />
      </main>
    </div>
    <BottomTabBar />
    <ToastHost />
    <ConfirmDialogHost />
    <OfflineBanner />
  </div>
</template>
