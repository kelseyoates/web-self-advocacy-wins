class MainActivity : ComponentActivity() {
    private val TAG = "MainActivity"
    
    override fun onCreate(savedInstanceState: Bundle?) {
        Log.d(TAG, "onCreate called")
        super.onCreate(savedInstanceState)
        
        Log.e("MainActivity", "onCreate: Setting up window")
        WindowCompat.setDecorFitsSystemWindows(window, false)
        
        Log.e("MainActivity", "onCreate: Setting content")
        setContent {
            Log.d(TAG, "setContent called")
            SelfAdvocacyWinsTheme {
                Log.d(TAG, "Theme applied")
                // A surface container using the 'background' color from the theme
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    Log.d(TAG, "Surface created")
                    MainScreen()
                    Log.d(TAG, "Navigation component initialized")
                }
            }
        }
        Log.e("MainActivity", "onCreate completed")
    }

    override fun onStart() {
        super.onStart()
        Log.d(TAG, "onStart called")
    }

    override fun onResume() {
        super.onResume()
        Log.d(TAG, "onResume called")
    }

    override fun onPause() {
        super.onPause()
        Log.d(TAG, "onPause called")
    }

    override fun onStop() {
        super.onStop()
        Log.d(TAG, "onStop called")
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "onDestroy called")
    }
}

@Composable
fun MainScreen() {
    Log.e("MainActivity", "MainScreen started")
    var currentScreen by remember { mutableStateOf<Screen>(Screen.Home) }
    
    Log.e("MainActivity", "MainScreen: Setting up navigation")
    NavigationContainer(
        currentScreen = currentScreen,
        onScreenChange = { screen ->
            Log.e("MainActivity", "Navigation changing to: ${screen.name}")
            currentScreen = screen
        }
    )
    Log.e("MainActivity", "MainScreen completed")
} 