import org.junit.Before;
import org.junit.Test;

import static org.junit.Assert.*;

public class AppTest {

    App underTest;

    @Before
    public void setup() {
        underTest = new App();
    }

    @Test
    public void testConcat() throws Exception {
        assertEquals("Hello World", underTest.concat("Hello", "World"));
    }
}