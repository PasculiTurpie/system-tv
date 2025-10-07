import { Link } from "react-router-dom";
import * as Yup from "yup";
import Swal from "sweetalert2";

const SchemaTipoEquipos = Yup.object().shape({
    tipoNombre: Yup.string()
        .trim("No debe tener espacios al inicio o al final")
        .required("Campo obligatorio"),
});

const TipoEquipoForm = () => {

    return (
        <>
            <div className="outlet-main">
                <nav aria-label="breadcrumb">
                    <ol className="breadcrumb">
                        <li className="breadcrumb-item">
                            <Link to="/list-type-equitment">Listar</Link>
                        </li>
                        <li
                            className="breadcrumb-item active"
                            aria-current="page"
                        >
                            Formulario
                        </li>
                    </ol>
                </nav>
                <h1>Registro de Tipo Equipo</h1>
                 <div className='tipo__section'>
                    <hr className='section__divider' />

                   </div>
                   
            
       </div>
       </>
    );
};

export default TipoEquipoForm;
