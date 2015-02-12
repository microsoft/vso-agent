/**
 *  Sample app for testing java build tasks
 */
public class App {

    public static void main(String[] args) {
        App app = new App();
        System.out.println(app.concat("Hello", "World"));
    }

    public String concat(String a, String b) {
        return String.format("%s %s", a, b);
    }
}
