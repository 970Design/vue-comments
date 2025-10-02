declare module '@970design/vue-comments' {
    import { DefineComponent } from 'vue'

    // Comment interface
    interface Comment {
        id: number
        author_name: string
        author_email: string
        content: string
        date: string
        parent: number
        approved?: boolean
    }

    // API Response interfaces
    interface CommentSubmitResponse {
        message: string
        approved?: boolean
    }

    // Component props interface
    interface VueCommentsProps {
        post_id: string | number
        endpoint: string
        api_key: string
    }

    // Export component
    export default DefineComponent<VueCommentsProps>
}